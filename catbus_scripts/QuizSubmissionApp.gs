function doGetQuizSubmission() {
  return HtmlService.createTemplateFromFile('quiz_submission')
    .evaluate()
    .setTitle('Tax Clinic Training Quiz')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
