const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
  const { Materials, PurchaseOrders, PurchaseOrderItems } = this.entities;

  async function recalculateOrderTotal(orderId) {
    if (!orderId) return;
    const items = await SELECT.from(PurchaseOrderItems).where({ order_ID: orderId });
    const total = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
    await UPDATE(PurchaseOrders)
      .set({ totalAmount: Number(total.toFixed(2)) })
      .where({ ID: orderId });
  }

  this.before('CREATE', PurchaseOrders, async (req) => {
    const data = req.data;
    if (!data.orderNumber) {
      const existing = await SELECT.from(PurchaseOrders).columns('orderNumber');
      const nextNum = String(existing.length + 1).padStart(4, '0');
      const year = new Date().getFullYear();
      data.orderNumber = `PO-${year}-${nextNum}`;
    }
    if (!data.status) data.status = 'DRAFT';
    if (!data.orderDate) data.orderDate = new Date().toISOString().slice(0, 10);
    if (!data.currencyCode) data.currencyCode = 'USD';

    if (Array.isArray(data.items) && data.items.length > 0) {
      let total = 0;
      for (const item of data.items) {
        if (!item.quantity || item.quantity <= 0) {
          req.reject(400, 'La cantidad de cada ítem debe ser mayor a 0.');
        }
        if (item.unitPrice == null && item.material_ID) {
          const mat = await SELECT.one.from(Materials).where({ ID: item.material_ID });
          if (!mat) req.reject(404, `Material no encontrado: ${item.material_ID}`);
          item.unitPrice = mat.unitPrice;
        }
        item.lineTotal = Number((Number(item.quantity) * Number(item.unitPrice || 0)).toFixed(2));
        total += item.lineTotal;
      }
      data.totalAmount = Number(total.toFixed(2));
    }
  });

  this.before(['CREATE', 'UPDATE'], PurchaseOrderItems, async (req) => {
    const data = req.data;
    if (data.quantity !== undefined && data.quantity <= 0) {
      req.reject(400, 'La cantidad debe ser mayor a 0.');
    }

    let current = {};
    if (req.event === 'UPDATE' && data.ID) {
      current = (await SELECT.one.from(PurchaseOrderItems).where({ ID: data.ID })) || {};
    }

    const materialId = data.material_ID || current.material_ID;
    const quantity = data.quantity !== undefined ? data.quantity : current.quantity;
    let unitPrice = data.unitPrice !== undefined ? data.unitPrice : current.unitPrice;

    if (unitPrice == null && materialId) {
      const mat = await SELECT.one.from(Materials).where({ ID: materialId });
      if (!mat) req.reject(404, 'Material no encontrado.');
      unitPrice = mat.unitPrice;
      data.unitPrice = unitPrice;
    }

    if (quantity != null && unitPrice != null) {
      data.lineTotal = Number((Number(quantity) * Number(unitPrice)).toFixed(2));
    }
  });

  this.after(['CREATE', 'UPDATE'], PurchaseOrderItems, async (data) => {
    if (data && data.order_ID) {
      await recalculateOrderTotal(data.order_ID);
    }
  });

  this.on('submitOrder', PurchaseOrders, async (req) => {
    const order = await SELECT.one.from(PurchaseOrders).where(req.params[0]);
    if (!order) return req.reject(404, 'Orden de compra no encontrada.');
    if (order.status !== 'DRAFT') {
      return req.reject(400, `Solo se pueden enviar órdenes en estado DRAFT (actual: ${order.status}).`);
    }
    const items = await SELECT.from(PurchaseOrderItems).where({ order_ID: order.ID });
    if (items.length === 0) {
      return req.reject(400, 'La orden debe tener al menos un ítem antes de enviarse.');
    }
    await UPDATE(PurchaseOrders).set({ status: 'PENDING' }).where({ ID: order.ID });
    return SELECT.one.from(PurchaseOrders).where({ ID: order.ID });
  });

  this.on('approveOrder', PurchaseOrders, async (req) => {
    const order = await SELECT.one.from(PurchaseOrders).where(req.params[0]);
    if (!order) return req.reject(404, 'Orden de compra no encontrada.');
    if (!['DRAFT', 'PENDING'].includes(order.status)) {
      return req.reject(400, `No se puede aprobar una orden en estado ${order.status}.`);
    }
    const items = await SELECT.from(PurchaseOrderItems).where({ order_ID: order.ID });
    if (items.length === 0) {
      return req.reject(400, 'La orden no tiene ítems para aprobar.');
    }
    await UPDATE(PurchaseOrders).set({ status: 'APPROVED' }).where({ ID: order.ID });
    return SELECT.one.from(PurchaseOrders).where({ ID: order.ID });
  });

  this.on('receiveGoods', PurchaseOrders, async (req) => {
    const order = await SELECT.one.from(PurchaseOrders).where(req.params[0]);
    if (!order) return req.reject(404, 'Orden de compra no encontrada.');
    if (order.status !== 'APPROVED') {
      return req.reject(400, `Solo se puede recibir mercancía de órdenes APPROVED (actual: ${order.status}).`);
    }

    const items = await SELECT.from(PurchaseOrderItems).where({ order_ID: order.ID });
    for (const item of items) {
      const mat = await SELECT.one.from(Materials).where({ ID: item.material_ID });
      if (mat) {
        const newStock = Number(mat.stockQty || 0) + Number(item.quantity || 0);
        await UPDATE(Materials).set({ stockQty: newStock }).where({ ID: mat.ID });
      }
    }

    await UPDATE(PurchaseOrders).set({ status: 'RECEIVED' }).where({ ID: order.ID });
    return SELECT.one.from(PurchaseOrders).where({ ID: order.ID });
  });

  this.on('cancelOrder', PurchaseOrders, async (req) => {
    const order = await SELECT.one.from(PurchaseOrders).where(req.params[0]);
    if (!order) return req.reject(404, 'Orden de compra no encontrada.');
    if (!['DRAFT', 'PENDING'].includes(order.status)) {
      return req.reject(400, `No se puede cancelar una orden en estado ${order.status}.`);
    }
    await UPDATE(PurchaseOrders).set({ status: 'CANCELLED' }).where({ ID: order.ID });
    return SELECT.one.from(PurchaseOrders).where({ ID: order.ID });
  });

  this.on('getDashboardStats', async () => {
    const materials = await SELECT.from(Materials);
    const orders = await SELECT.from(PurchaseOrders);

    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalInventoryValue = 0;

    for (const m of materials) {
      const qty = Number(m.stockQty || 0);
      const min = Number(m.minStock || 0);
      const price = Number(m.unitPrice || 0);
      if (qty === 0) outOfStockCount++;
      else if (qty <= min) lowStockCount++;
      totalInventoryValue += qty * price;
    }

    const pendingOrdersCount = orders.filter((o) => o.status === 'PENDING').length;
    const approvedOrdersCount = orders.filter((o) => o.status === 'APPROVED').length;

    return {
      totalMaterials: materials.length,
      lowStockCount,
      outOfStockCount,
      pendingOrdersCount,
      approvedOrdersCount,
      totalInventoryValue: Number(totalInventoryValue.toFixed(2))
    };
  });

  this.on('adjustStock', async (req) => {
    const { materialID, delta } = req.data;
    if (!materialID) return req.reject(400, 'materialID es obligatorio.');
    const mat = await SELECT.one.from(Materials).where({ ID: materialID });
    if (!mat) return req.reject(404, 'Material no encontrado.');

    const nextQty = Number(mat.stockQty || 0) + Number(delta || 0);
    if (nextQty < 0) {
      return req.reject(400, 'El stock resultante no puede ser negativo.');
    }

    await UPDATE(Materials).set({ stockQty: nextQty }).where({ ID: materialID });
    return SELECT.one.from(Materials).where({ ID: materialID });
  });
});
