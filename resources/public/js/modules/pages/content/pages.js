(function(global) {
  var editors = global.caribou.editors;
  if (!editors || !editors.TreeEditor) {
    throw "editors.js and tree.js have not been included";
  }

  if (!$("#all-pages")[0]) { return };
  var api = window.caribou.api;
  var stack = $("#all-pages").editorStack();

  var options = {
    model: api.model( "page" ),
    submit: function( value, next ) {
      console.log("Holy smokes, batman!", value);
    }
  };

  $.ajax({ url: window.caribou.api.routeFor("find-all", { model: "page" }), success: function( data ) {
    var editor = new window.caribou.editors.TreeEditor({ model: "page", value: data, expands: true });
    editor.template = "";
    stack.push(editor);
  }});
})(window);
