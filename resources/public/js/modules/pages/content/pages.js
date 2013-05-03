(function(global) {
  var editors = global.caribou.editors;
  if (!editors || !editors.TreeEditor) {
    throw "editors.js and tree.js have not been included";
  }

  function showNewDialog(path) {
    var elementData = {};
    $.ajax({
      type: "GET",
      url: global.caribou.api.routeFor("list-controllers-and-actions"),
      success: function( data, error, jqxhr ) {
        if (path) {
          // initialise path value
          $("#new-page input[name=path]").val( path );
        }
        var template = $("#new-page input[name=template]");
        template.data().dirty = false;
        template.on("keyup change", function(e) {
          template.data().dirty = true;
        });

        var controller = $("#new-page select[name=controller]").empty().append("<option>Existing controllers</option>");
        $( data ).each( function( index, item ) {
          controller.append("<option value='" + item.path + "'>" + item.path + "</option>");
        });
        controller.sortOptionList();
        controller.on("change", function() {
          var value = controller.val();
          var info = _( data ).find(function(e) { return e['path'] === value });
          console.log(info);
          var action = $("#new-page select[name=action]").empty().append("<option>Available actions</options>");
          $( info.actions ).each( function( index, item ) {
            action.append("<option value='" + item + "'>" + item + "</option>");
          });
          action.on("change", function() {
            if (!template.val() || !template.data().dirty) {
              template.val( controller.val().replace("\.", "/") + "/" + action.val().replace("-", "_") + ".html" );
            }
          });
          $("#new-page .action-controls").show();
        });

        $("#new-page").modal();
      }
    });

    return false;
  }

  global.caribou.pages = {
    showNewDialog: showNewDialog
  };

  if (!$("#all-pages")[0]) { return };
  var api = window.caribou.api;
  var stack = $("#all-pages").editorStack();

  var options = {
    model: api.model( "page" ),
    submit: function( value, next ) {
      console.log("Holy smokes, batman!", value);
      console.log( value );
    }
  };

  var delegate = {
    select: function( pageInfo ) {
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
    },

    labelFor: function( node, isShort ) {
      if ( isShort ) { return $(node).data().label }
      var parentNodes = $(node).parents("li");
      var parts = [];
      parentNodes.each(function( index, item ) {
        parts.unshift( $(item).data().label );
      });
      parts.push( $(node).data().label );
      return parts.join("/");
    }
  };

  $.ajax({ url: window.caribou.api.routeFor("find-all", { model: "page" }), success: function( data ) {
    var editor = new window.caribou.editors.TreeEditor({
      model: window.caribou.api.model("page"),
      value: data,
      expands: true,
      delegate: delegate
    });
    editor.template = "";
    stack.push(editor);
  }});
})(window);
