/**
 * Product Code Distribution App Entry Point
 * This is the entry point for the Product Code Distribution web app
 */

/**
 * Entry point for Product Code Distribution web app
 * @returns {HtmlOutput} The HTML output for the product code dashboard
 */
function doGetProductCodeDistribution() {
  return HtmlService.createTemplateFromFile('product_code_dashboard')
    .evaluate()
    .setTitle('Product Code Distribution')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}
