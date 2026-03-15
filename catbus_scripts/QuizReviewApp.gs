/**
 * Quiz Review App
 * Admin interface for reviewing and grading quiz submissions
 */

function doGetQuizReview() {
  return HtmlService.createTemplateFromFile('quiz_review')
    .evaluate()
    .setTitle('Quiz Review')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.SAMEORIGIN);
}
