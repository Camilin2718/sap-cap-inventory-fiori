namespace sap.mm.inventory;

using { cuid, managed } from '@sap/cds/common';

entity Suppliers : cuid, managed {
  code           : String(20) not null;
  name           : String(100) not null;
  email          : String(100);
  phone          : String(30);
  city           : String(60);
  country        : String(60);
  rating         : Decimal(2,1) default 4.5;
  purchaseOrders : Association to many PurchaseOrders on purchaseOrders.supplier = $self;
}

entity Materials : cuid, managed {
  sku           : String(30) not null;
  name          : String(120) not null;
  description   : String(255);
  category      : String(60) not null;
  unitOfMeasure : String(10) default 'UND';
  unitPrice     : Decimal(12,2) not null;
  currencyCode  : String(3) default 'USD';
  stockQty      : Integer not null default 0;
  minStock      : Integer not null default 10;
  location      : String(60) default 'Bodega Central';
  supplier      : Association to Suppliers;
}

entity PurchaseOrders : cuid, managed {
  orderNumber  : String(20) not null;
  supplier     : Association to Suppliers not null;
  status       : String(20) not null default 'DRAFT'; // DRAFT | PENDING | APPROVED | RECEIVED | CANCELLED
  orderDate    : Date;
  expectedDate : Date;
  totalAmount  : Decimal(14,2) default 0;
  currencyCode : String(3) default 'USD';
  notes        : String(255);
  items        : Composition of many PurchaseOrderItems on items.order = $self;
}

entity PurchaseOrderItems : cuid {
  order     : Association to PurchaseOrders not null;
  material  : Association to Materials not null;
  quantity  : Integer not null;
  unitPrice : Decimal(12,2) not null;
  lineTotal : Decimal(14,2) default 0;
}
