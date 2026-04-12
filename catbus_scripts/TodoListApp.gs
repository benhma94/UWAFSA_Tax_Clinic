/**
 * TodoListApp.gs
 * Serves the To-Do List page via HtmlService.
 */

/**
 * Serves todo_list.html. Called by Router.gs for ?app=todo.
 */
function doGetTodoList() {
  return loadPage('todo_list', 'To-Do List');
}
