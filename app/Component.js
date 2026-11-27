sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/model/json/JSONModel"
], function (UIComponent, JSONModel) {
  "use strict";

  return UIComponent.extend("sap.mm.inventory.ui.Component", {
    metadata: {
      manifest: "json"
    },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);

      const oUiModel = new JSONModel({
        stats: {
          totalMaterials: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          pendingOrdersCount: 0,
          approvedOrdersCount: 0,
          totalInventoryValue: 0
        },
        selectedOrderPath: "",
        hasSelectedOrder: false,
        selectedOrderStatus: "",
        searchMaterialQuery: "",
        selectedCategory: "ALL"
      });
      this.setModel(oUiModel, "ui");
    }
  });
});
