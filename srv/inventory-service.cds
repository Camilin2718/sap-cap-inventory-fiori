using { sap.mm.inventory as db } from '../db/schema';

@(path: '/odata/v4/inventory')
service InventoryService {
  entity Suppliers          as projection on db.Suppliers;
  entity Materials          as projection on db.Materials;
  entity PurchaseOrderItems as projection on db.PurchaseOrderItems;

  entity PurchaseOrders as projection on db.PurchaseOrders actions {
    action submitOrder()  returns PurchaseOrders;
    action approveOrder() returns PurchaseOrders;
    action receiveGoods() returns PurchaseOrders;
    action cancelOrder()  returns PurchaseOrders;
  };

  type DashboardStats {
    totalMaterials      : Integer;
    lowStockCount       : Integer;
    outOfStockCount     : Integer;
    pendingOrdersCount  : Integer;
    approvedOrdersCount : Integer;
    totalInventoryValue : Decimal(14,2);
  }

  function getDashboardStats() returns DashboardStats;
  action adjustStock(materialID: UUID, delta: Integer, reason: String) returns Materials;
}
