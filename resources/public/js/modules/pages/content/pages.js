(function(global) {
  var editors = global.caribou.editors;
  var api     = global.caribou.api;
  var models  = global.caribou.models;

  if (!editors || !editors.TreeEditor) {
    throw "editors.js and tree.js have not been included";
  }

  // ================================================
  // Class represents the New Page dialog
  // ================================================
  function NewPageDialog( selector ) {
    this._element = $(selector).clone();
  }

  NewPageDialog.prototype = {
    form:            function() { return this._element.find("form") },
    pathField:       function() { return this._element.find("input[name=path]") },
    nameField:       function() { return this._element.find("input[name=name]") },
    controllerField: function() { return this._element.find("select[name=controller]") },
    actionField:     function() { return this._element.find("select[name=action]") },
    templateField:   function() { return this._element.find("input[name=template]") },
    controllerOtherField: function() { return this._element.find("input[name=controller-other]") },
    actionOtherField:     function() { return this._element.find("input[name=action-other]") },

    parentId:   function() { return this._element.find("input[name=parent_id]").val() },
    parentPath: function() { return this._element.find("span[id=parent-path]").val() },
    path:       function() { return this.pathField().val() },
    name:       function() { return this.nameField().val() },
    controller: function() { return this.controllerField().val() },
    action:     function() { return this.actionField().val() },
    template:   function() { return this.templateField().val() },
    controllerOther: function() { return this.controllerOtherField().val() },
    actionOther:     function() { return this.actionOtherField().val() },

    setParentId:   function(v) { this._element.find("input[name=parent_id]").val(v) },
    setParentPath: function(v) { this._element.find("span[id=parent-path]").html(v) },
    setPath:       function(v) { this.pathField().val(v) },
    setName:       function(v) { this.nameField().val(v) },
    setController: function(v) { this.controllerField().val(v) },
    setAction:     function(v) { this.actionField().val(v) },
    setTemplate:   function(v) { this.templateField().val(v) },

    setControllerOptions: function( data ) {
      var self = this;
      self.controllerField().empty().append("<option value=''>Existing controllers</option>");
      $( data ).each( function( index, item ) {
        self.controllerField().append("<option value='" + item.path + "'>" + item.path + "</option>");
      });
      self.controllerField().sortOptionList();
      self.controllerField().on("change", function() {
        var value = self.controller();
        var info = _( data ).find(function(e) { return e['path'] === value });
        self.setActionOptions( info.actions );
      });
    },

    setActionOptions: function( data ) {
      var self = this;
      self.actionField().empty().append("<option value=''>Available actions</options>");
      $( data ).each( function( index, item ) {
        self.actionField().append("<option value='" + item + "'>" + item + "</option>");
      });
      self.actionField().on("change", function() {
        if (!self.template() || !self.templateField().data().dirty) {
          self.setTemplate( self.controller().replace(/\./g, "/") + "/" + self.action().replace(/-/g, "_") + ".html" );
        }
      });
    },

    show: function() {
      this._element.modal();
    },

    indicateValidationFailure: function( field ) {
      field.parents(".control-group:first").addClass("error");
      return false;
    },

    validate: function() {
      var self = this;
      var isOk = true;
      if ( !self.name() ) {
        isOk = self.indicateValidationFailure( self.nameField() );
      }
      if ( !self.controller() && !self.controllerOther() ) {
        isOk = self.indicateValidationFailure( self.controllerField() );
      }
      if ( !self.action() && !self.actionOther() ) {
        isOk = self.indicateValidationFailure( self.actionField() );
      }
      if ( !self.template() ) {
        isOk = self.indicateValidationFailure( self.templateField() );
      }
      return isOk;
    },

    submit: function() {
      var self = this;
      console.log("click!");
      var isValid = self.validate();

      if (isValid) {
        //self.form().off("submit").trigger("submit");

        var data = [{
          model: "page",
          fields: {
            name: self.name(),
            path: self.path(),
            template: self.template(),
            controller: self.controller() || self.controllerOther(),
            action: self.action() || self.actionOther(),
            parent_id: self.parentId(),
          }
        }];
        global.caribou.api.post( data );

        return false;
      }
      return false;
    }
  };

  function showNewDialog( info, path ) {
    var dialog = new NewPageDialog("#new-page");

    dialog.form().on("submit", function(e) {
      e.preventDefault();
      return dialog.submit();
    });

    $.ajax({
      type: "GET",
      url: global.caribou.api.routeFor("list-controllers-and-actions"),
      success: function( data, error, jqxhr ) {
        dialog.setParentPath( path );

        if (info && info.id) {
          dialog.setParentId( info.id );
        }
        dialog.nameField().on("blur", function(e) {
          if (! dialog.path() ) {
            dialog.setPath( dialog.name().toLowerCase().replace(/[\s_]+/g, "-") );
          }
        });

        dialog.templateField().data().dirty = false;
        dialog.templateField().on("keyup change", function(e) {
          dialog.templateField().data().dirty = true;
        });

        dialog.setControllerOptions( data );
        dialog.show();
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
    makeHeader: function() {
      return $('<tr><th>Route</th><th>Path</th><th>Controller</th><th>Action</th><th>Template</th><th>Controls</th></tr>');
    },
    makeNode: function( node ) {
      var self = this;
      return $('<tr data-id="' + (node.id) +
        '" data-parent-id="' + (node.id? (node.parentId || "0") : "") + '" >' +
        '<td class="treenode">' + node.label + '</td><td>' + delegate.labelFor(node) + '</td>' +
        '<td>' + (node.node.controller || "") + '</td><td>' + (node.node.action || "") + '</td>' +
        '<td>' + (node.node.template || "") + '</td><td class="controls">&nbsp;</td></tr>');
    },
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
              $("#page-editor").empty();
              delete $("#page-editor").data().stack;
              window.location.reload();
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
      var current = node;
      var bits = [];
      while (current.parent) {
        bits.unshift( current.node.path );
        current = current.parent;
      }
      return bits.join("/");
    },

    removeControls: function( tree, el, node ) {
      $(el).find("td.controls").empty();
    },
    addControls: function( tree, el, node ) {
      el = $(el);
      if (!node) { return }

      var controls = el.find("td.controls");

      if (node.id) {
        var selectLink = $("<a href='#'><span class='instrument-icon-pencil'></span></a>").on("click", function(e) {
          console.log(node);
          delegate.select( node );
        });
        controls.append( selectLink );
      }

      var addLink = $("<a href='#'><span class='instrument-icon-circle-plus'></span></a>").on("click", function(e) {
        showNewDialog( node, delegate.labelFor(node) );
      });
      controls.append( addLink );

      if ( !node.children || node.children.length === 0 ) {
        var destroyLink = $("<a href='#' data-model='page' data-id='" + node.id + "'><span class='instrument-icon-circle-close'></span></a>").on("click", function(e) {
          models.showDeleteDialog( this, function() {
            delegate.reload( tree );
          });
        });
        controls.append( destroyLink );
      }
    },
    reload: function( tree ) {
      $.ajax({
        type: "GET",
        url: api.routeFor("find-all", { model: "page" }),
        success: function( data ) {
          console.log(data);
          tree.value = data;
          tree.serverValue = null;
          tree.attach();
        }
      });
    },
    update: function( tree, data ) {
      console.log(data);
      api.post( data, function() {
        console.log("Updated page tree on server");
        delegate.reload( tree );
      });
    }
  };

  $.ajax({ url: global.caribou.api.routeFor("find-all", { model: "page" }), success: function( data ) {
    var editor = new global.caribou.editors.TreeEditor({
      model: global.caribou.api.model("page"),
      value: data,
      expands: true,
      delegate: delegate
    });
    editor.template = "";
    stack.push(editor);
  }});
})(window);
