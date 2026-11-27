sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/m/Dialog",
  "sap/m/Button",
  "sap/m/Label",
  "sap/m/Input",
  "sap/m/Select",
  "sap/ui/core/Item",
  "sap/m/VBox"
], function (
  Controller,
  Filter,
  FilterOperator,
  MessageToast,
  MessageBox,
  Dialog,
  Button,
  Label,
  Input,
  Select,
  Item,
  VBox
) {
  "use strict";

  return Controller.extend("sap.mm.inventory.ui.controller.App", {
    onInit: function () {
      this._loadDashboardStats();
    },

    _loadDashboardStats: async function () {
      try {
        const oResponse = await fetch("/odata/v4/inventory/getDashboardStats()");
        if (!oResponse.ok) throw new Error("Error cargando KPIs");
        const oData = await oResponse.json();
        this.getView().getModel("ui").setProperty("/stats", oData);
      } catch (err) {
        console.error(err);
      }
    },

    onRefreshAll: function () {
      const oModel = this.getView().getModel();
      if (oModel) {
        oModel.refresh();
      }
      this._loadDashboardStats();
      MessageToast.show("Datos actualizados");
    },

    onTabSelect: function (oEvent) {
      if (oEvent.getParameter("key") === "dashboard") {
        this._loadDashboardStats();
      }
    },

    onGoToMaterials: function () {
      this.byId("mainTabBar").setSelectedKey("materials");
    },

    onGoToOrders: function () {
      this.byId("mainTabBar").setSelectedKey("orders");
    },

    onSearchMaterials: function (oEvent) {
      const sQuery = (oEvent.getParameter("query") || "").trim();
      const oBinding = this.byId("materialsTable").getBinding("items");
      if (!oBinding) return;

      if (!sQuery) {
        oBinding.filter([]);
      } else {
        oBinding.filter(
          new Filter({
            filters: [
              new Filter("name", FilterOperator.Contains, sQuery),
              new Filter("sku", FilterOperator.Contains, sQuery),
              new Filter("category", FilterOperator.Contains, sQuery)
            ],
            and: false
          })
        );
      }
    },

    onSelectOrder: function (oEvent) {
      const oItem = oEvent.getParameter("listItem");
      if (!oItem) return;
      const oCtx = oItem.getBindingContext();
      const oPanel = this.byId("orderDetailPanel");
      oPanel.setBindingContext(oCtx);
      this.getView().getModel("ui").setProperty("/hasSelectedOrder", true);
    },

    _runOrderAction: async function (sActionName, sSuccessMsg) {
      const oPanel = this.byId("orderDetailPanel");
      const oCtx = oPanel.getBindingContext();
      if (!oCtx) return;

      const sOrderId = oCtx.getProperty("ID");
      try {
        const oRes = await fetch(
          `/odata/v4/inventory/PurchaseOrders(${sOrderId})/InventoryService.${sActionName}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
          }
        );

        if (!oRes.ok) {
          const oErr = await oRes.json().catch(() => ({}));
          const sMsg = (oErr.error && oErr.error.message) || "No se pudo ejecutar la acción.";
          MessageBox.error(sMsg);
          return;
        }

        MessageToast.show(sSuccessMsg);
        this.getView().getModel().refresh();
        this._loadDashboardStats();
      } catch (err) {
        MessageBox.error(err.message);
      }
    },

    onSubmitOrder: function () {
      this._runOrderAction("submitOrder", "Orden enviada a aprobación");
    },

    onApproveOrder: function () {
      this._runOrderAction("approveOrder", "Orden aprobada correctamente");
    },

    onReceiveGoods: function () {
      this._runOrderAction("receiveGoods", "Mercancía recibida y stock actualizado");
    },

    onCancelOrder: function () {
      this._runOrderAction("cancelOrder", "Orden cancelada");
    },

    onOpenAdjustStockDialog: function (oEvent) {
      const oCtx = oEvent.getSource().getBindingContext();
      const sMaterialId = oCtx.getProperty("ID");
      const sMaterialName = oCtx.getProperty("name");
      const iCurrentStock = oCtx.getProperty("stockQty");

      const oDeltaInput = new Input({ type: "Number", placeholder: "Ej: 10 o -2" });
      const oReasonInput = new Input({ placeholder: "Motivo del ajuste (ej. Conteo físico)" });

      const oDialog = new Dialog({
        title: `Ajustar Stock: ${sMaterialName}`,
        contentWidth: "24rem",
        content: new VBox({
          items: [
            new Label({ text: `Stock actual: ${iCurrentStock}` }),
            new Label({ text: "Cantidad a sumar o restar (+/-)", required: true }),
            oDeltaInput,
            new Label({ text: "Motivo" }),
            oReasonInput
          ]
        }).addStyleClass("sapUiSmallMargin"),
        beginButton: new Button({
          text: "Aplicar",
          type: "Emphasized",
          press: async () => {
            const iDelta = parseInt(oDeltaInput.getValue(), 10);
            if (isNaN(iDelta) || iDelta === 0) {
              MessageBox.warning("Ingresa una cantidad válida distinta de 0.");
              return;
            }
            try {
              const oRes = await fetch("/odata/v4/inventory/adjustStock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  materialID: sMaterialId,
                  delta: iDelta,
                  reason: oReasonInput.getValue() || "Ajuste manual"
                })
              });
              if (!oRes.ok) {
                const oErr = await oRes.json().catch(() => ({}));
                MessageBox.error((oErr.error && oErr.error.message) || "Error al ajustar stock");
                return;
              }
              MessageToast.show("Stock actualizado");
              oDialog.close();
              this.onRefreshAll();
            } catch (err) {
              MessageBox.error(err.message);
            }
          }
        }),
        endButton: new Button({
          text: "Cancelar",
          press: () => oDialog.close()
        }),
        afterClose: () => oDialog.destroy()
      });

      oDialog.open();
    },

    onOpenNewMaterialDialog: function () {
      const oSkuInput = new Input({ placeholder: "MAT-1009" });
      const oNameInput = new Input({ placeholder: "Nombre del material" });
      const oCatInput = new Input({ placeholder: "Ej. Hardware TI, Redes, Almacén" });
      const oPriceInput = new Input({ type: "Number", placeholder: "0.00" });
      const oStockInput = new Input({ type: "Number", value: "0" });
      const oMinStockInput = new Input({ type: "Number", value: "5" });

      const oSupplierSelect = new Select({
        width: "100%",
        items: {
          path: "/Suppliers",
          template: new Item({ key: "{ID}", text: "{name}" })
        }
      });
      oSupplierSelect.setModel(this.getView().getModel());

      const oDialog = new Dialog({
        title: "Nuevo Material (MM)",
        contentWidth: "26rem",
        content: new VBox({
          items: [
            new Label({ text: "SKU", required: true }),
            oSkuInput,
            new Label({ text: "Nombre", required: true }),
            oNameInput,
            new Label({ text: "Categoría", required: true }),
            oCatInput,
            new Label({ text: "Proveedor" }),
            oSupplierSelect,
            new Label({ text: "Precio Unitario (USD)", required: true }),
            oPriceInput,
            new Label({ text: "Stock Inicial" }),
            oStockInput,
            new Label({ text: "Stock Mínimo" }),
            oMinStockInput
          ]
        }).addStyleClass("sapUiSmallMargin"),
        beginButton: new Button({
          text: "Guardar",
          type: "Emphasized",
          press: async () => {
            const payload = {
              sku: oSkuInput.getValue().trim(),
              name: oNameInput.getValue().trim(),
              category: oCatInput.getValue().trim() || "General",
              unitPrice: parseFloat(oPriceInput.getValue()) || 0,
              stockQty: parseInt(oStockInput.getValue(), 10) || 0,
              minStock: parseInt(oMinStockInput.getValue(), 10) || 5,
              supplier_ID: oSupplierSelect.getSelectedKey() || null
            };
            if (!payload.sku || !payload.name || payload.unitPrice <= 0) {
              MessageBox.warning("Completa SKU, Nombre y un Precio válido.");
              return;
            }
            try {
              const oRes = await fetch("/odata/v4/inventory/Materials", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
              });
              if (!oRes.ok) {
                const oErr = await oRes.json().catch(() => ({}));
                MessageBox.error((oErr.error && oErr.error.message) || "Error al crear material");
                return;
              }
              MessageToast.show("Material creado");
              oDialog.close();
              this.onRefreshAll();
            } catch (err) {
              MessageBox.error(err.message);
            }
          }
        }),
        endButton: new Button({
          text: "Cancelar",
          press: () => oDialog.close()
        }),
        afterClose: () => oDialog.destroy()
      });

      oDialog.open();
    },

    onOpenNewOrderDialog: function () {
      const oSupplierSelect = new Select({
        width: "100%",
        items: {
          path: "/Suppliers",
          template: new Item({ key: "{ID}", text: "{name}" })
        }
      });
      oSupplierSelect.setModel(this.getView().getModel());

      const oNotesInput = new Input({ placeholder: "Observaciones de la orden" });

      const oDialog = new Dialog({
        title: "Nueva Orden de Compra",
        contentWidth: "24rem",
        content: new VBox({
          items: [
            new Label({ text: "Proveedor", required: true }),
            oSupplierSelect,
            new Label({ text: "Notas" }),
            oNotesInput
          ]
        }).addStyleClass("sapUiSmallMargin"),
        beginButton: new Button({
          text: "Crear Borrador",
          type: "Emphasized",
          press: async () => {
            const sSupplierId = oSupplierSelect.getSelectedKey();
            if (!sSupplierId) {
              MessageBox.warning("Selecciona un proveedor.");
              return;
            }
            try {
              const oRes = await fetch("/odata/v4/inventory/PurchaseOrders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  supplier_ID: sSupplierId,
                  notes: oNotesInput.getValue().trim() || "Orden creada desde Fiori"
                })
              });
              if (!oRes.ok) {
                const oErr = await oRes.json().catch(() => ({}));
                MessageBox.error((oErr.error && oErr.error.message) || "Error al crear orden");
                return;
              }
              MessageToast.show("Orden creada en estado Borrador");
              oDialog.close();
              this.onRefreshAll();
            } catch (err) {
              MessageBox.error(err.message);
            }
          }
        }),
        endButton: new Button({
          text: "Cancelar",
          press: () => oDialog.close()
        }),
        afterClose: () => oDialog.destroy()
      });

      oDialog.open();
    },

    onOpenAddItemDialog: function () {
      const oPanel = this.byId("orderDetailPanel");
      const oCtx = oPanel.getBindingContext();
      if (!oCtx) return;
      const sOrderId = oCtx.getProperty("ID");

      const oMaterialSelect = new Select({
        width: "100%",
        items: {
          path: "/Materials",
          template: new Item({ key: "{ID}", text: "{sku} - {name} (${unitPrice})" })
        }
      });
      oMaterialSelect.setModel(this.getView().getModel());

      const oQtyInput = new Input({ type: "Number", value: "1" });

      const oDialog = new Dialog({
        title: "Agregar Ítem a la Orden",
        contentWidth: "26rem",
        content: new VBox({
          items: [
            new Label({ text: "Material", required: true }),
            oMaterialSelect,
            new Label({ text: "Cantidad", required: true }),
            oQtyInput
          ]
        }).addStyleClass("sapUiSmallMargin"),
        beginButton: new Button({
          text: "Agregar",
          type: "Emphasized",
          press: async () => {
            const sMaterialId = oMaterialSelect.getSelectedKey();
            const iQty = parseInt(oQtyInput.getValue(), 10);
            if (!sMaterialId || isNaN(iQty) || iQty <= 0) {
              MessageBox.warning("Selecciona un material y una cantidad mayor a 0.");
              return;
            }
            try {
              const oRes = await fetch("/odata/v4/inventory/PurchaseOrderItems", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  order_ID: sOrderId,
                  material_ID: sMaterialId,
                  quantity: iQty
                })
              });
              if (!oRes.ok) {
                const oErr = await oRes.json().catch(() => ({}));
                MessageBox.error((oErr.error && oErr.error.message) || "Error al agregar ítem");
                return;
              }
              MessageToast.show("Ítem agregado");
              oDialog.close();
              this.onRefreshAll();
            } catch (err) {
              MessageBox.error(err.message);
            }
          }
        }),
        endButton: new Button({
          text: "Cancelar",
          press: () => oDialog.close()
        }),
        afterClose: () => oDialog.destroy()
      });

      oDialog.open();
    },

    formatStockText: function (iStock, iMin) {
      if (iStock <= 0) return "Agotado";
      if (iStock <= iMin) return "Stock Bajo";
      return "Disponible";
    },

    formatStockState: function (iStock, iMin) {
      if (iStock <= 0) return "Error";
      if (iStock <= iMin) return "Warning";
      return "Success";
    },

    formatOrderStatusText: function (sStatus) {
      const mLabels = {
        DRAFT: "Borrador",
        PENDING: "Pendiente",
        APPROVED: "Aprobada",
        RECEIVED: "Recibida",
        CANCELLED: "Cancelada"
      };
      return mLabels[sStatus] || sStatus;
    },

    formatOrderStatusState: function (sStatus) {
      const mStates = {
        DRAFT: "None",
        PENDING: "Warning",
        APPROVED: "Information",
        RECEIVED: "Success",
        CANCELLED: "Error"
      };
      return mStates[sStatus] || "None";
    }
  });
});
