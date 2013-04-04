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

  var editPage = function( pageInfo ) {
    var editorStack = $("#page-editor").data().stack || $("#page-editor").editorStack();
    editorStack.clear();

    // ack
    var options = {
      model: api.model( "page" ),
      value: { id: pageInfo.id },
      submit: function( value, next ) {
        console.log("Holy smokes, batman!", value);
        var data = [{ model: "page", fields: editor.prepareForUpdate( value ) }]
        api.post( data, function( d ) {
          console.log(d);
          if (next) {
            next( d );
          } else {
            $("#editor").empty();
            delete $("#editor").data().stack;
          }
        });
      }
    };

    var editor = new window.caribou.editors.ModelEditor(options);
    editor.load( function( data, error, xhr ) {
      editor.value = data.state || {};
      editor.syncToChildren();
      editor.template = data.template;
      editorStack.push(editor);
    });
  };

  $.ajax({ url: window.caribou.api.routeFor("find-all", { model: "page" }), success: function( data ) {
    var editor = new window.caribou.editors.TreeEditor({
      model: window.caribou.api.model("page"),
      value: data,
      expands: true,
      select: editPage
    });
    editor.template = "";
    stack.push(editor);
  }});
})(window);
