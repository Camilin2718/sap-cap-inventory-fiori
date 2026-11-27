# Portal de Compras e Inventario (SAP CAP + SQLite + OpenUI5)

Aplicación empresarial estilo **SAP MM / SAP Fiori** construida 100 % con tecnologías gratuitas y de código abierto:

- **Backend:** [SAP Cloud Application Programming Model (CAP)](https://cap.cloud.sap/) sobre Node.js (`@sap/cds`)
- **Base de datos:** SQLite (`@cap-js/sqlite`) con datos iniciales en CSV
- **API:** OData v4 real (`/odata/v4/inventory`)
- **Frontend:** [OpenUI5](https://openui5.org/) con tema **SAP Horizon** (`sap_horizon`)

## Estructura del proyecto

```text
sap-cap-inventory-fiori/
├── app/                      # Frontend OpenUI5 (SAP Fiori)
│   ├── controller/
│   │   └── App.controller.js
│   ├── view/
│   │   └── App.view.xml
│   ├── Component.js
│   ├── index.html
│   └── manifest.json
├── db/                       # Modelo de datos CDS y datos semilla
│   ├── data/
│   │   ├── sap.mm.inventory-Materials.csv
│   │   ├── sap.mm.inventory-PurchaseOrderItems.csv
│   │   ├── sap.mm.inventory-PurchaseOrders.csv
│   │   └── sap.mm.inventory-Suppliers.csv
│   └── schema.cds
├── srv/                      # Servicio OData v4 y lógica de negocio
│   ├── inventory-service.cds
│   └── inventory-service.js
└── package.json
```

## Funcionalidades principales

1. **Dashboard ejecutivo (KPIs):** Total de materiales, alertas de stock crítico/agotado, órdenes en proceso y valorización total del inventario.
2. **Catálogo de Materiales (MM):** Búsqueda por SKU, nombre o categoría, creación de nuevos materiales y ajuste manual de stock (`adjustStock`).
3. **Órdenes de Compra (PO):** Flujo completo de estados (`DRAFT` → `PENDING` → `APPROVED` → `RECEIVED` / `CANCELLED`), cálculo automático de totales y actualización automática de inventario al recibir mercancía (`receiveGoods`).

## Cómo ejecutarlo localmente

```bash
pnpm install
pnpm dev
```

Luego abre en tu navegador:
- **Aplicación OpenUI5:** `http://localhost:4004/index.html`
- **Índice de servicios CAP / OData v4:** `http://localhost:4004/`
