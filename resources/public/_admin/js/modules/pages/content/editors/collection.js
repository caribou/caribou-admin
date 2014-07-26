//-------------------------------------------------------
// editors/collection.js
// A "collection" is commonly known as a "to-many" or
// "has-many" relationship.
// A "link" is commonly known as a "many-to-many"
// relationship.
//-------------------------------------------------------

(function (global) {
  global.caribou = global.caribou || {};
  var editors = global.caribou.editors;
  if (!editors) {
    throw "editors/base.js and editors/fields.js have not been included";
  }

  function CollectionFieldEditor( options) {
    editors.FieldEditor.call( this, options );
  }
  $.extend( CollectionFieldEditor.prototype, editors.FieldEditor.prototype, {
    selector: function() { return "span#" + this.field.slug; },
    syncToDOM: function() {
      $( this.selector() ).html( this.value ? this.value.length : "No" );
    },
    syncFromDOM: function() {},
    attach: function() {
      var self = this;
      var editButton = $("#edit-" + self.model.slug + "-" + self.field.slug);
      if ( self.parent.value && self.parent.value.id ) {
        editButton.show();
        editButton.click(function(e) {
          e.preventDefault();
          return self.edit();
        });
      } else {
        editButton.hide();
        // TODO: get rid of this and allow a user to edit related content
        // to an un-committed model
        editButton.before("You can edit this after you've saved your work.");
      }
    },
    edit: function() {
      var self = this;
      console.log("edit " + self.field.type + "...");
      var editor = new editors.CollectionEditor({
        from: self,
        instance: self.parent.value,
        instanceModel: self.model,
        model: self.api().model( self.field["target-id"] ),
        field: self.field,
        submit: function( value, next ) {
          self.value = value;
          self.callbackWithValue("sync", self.value, next);
        }
      });

      editor.load( function( data, error, jqxhr ) {
        editor.template = data.template;
        editor.value = data.value || editor.value;
        self.stack().push( editor );
      });
    }
  });

  function CollectionEditor( options ) {
    editors.Editor.call( this, options );
    this.field = options.field;
    this.instance = options.instance;
    this.instanceModel = options.instanceModel;
    this.page = 0;
    this.defaultPageSize = (
      global.caribou.config.pages.results['page-size'] || 20
    );
    this.pageSize = this.defaultPageSize;
  }
  $.extend( CollectionEditor.prototype, editors.Editor.prototype, {
    reciprocalField: function() {
      var self = this;
      if (self._reciprocalField) { return self._reciprocalField; }
      var reciprocalField = _( self.model.fields ).find( function(field) {
        return field.id == self.field["link-id"];
      });
      return self._reciprocalField = reciprocalField;
    },
    load: function( success, data ) {
      var self = this;
      var route = self.api().routeFor( "editor-associated-content", {
        model: self.instanceModel.slug,
        id: self.instance.id,
        template: "_paged_collection.html",
        page: self.page,
        size: self.pageSize,
        field: self.field.slug
      });
      var method = "GET";
      if (data) { method = "POST"; }
      $.ajax({ url: route, type: method, data: data, success: success });
    },
    // TODO: don't cut/paste this from base.js
    prepareForUpdate: function( data ) {
      var blacklist = _( this.model.fields ).chain().filter(
        function(f) {
          if ( f.type === "id" ) { return false; }
          if ( f.slug === "type" ) { return false; }
          if ( f.type === "integer" &&
               f.slug.match(/(^|_|-)id$/) ) {
            return false;
          }
          if ( f.type === "part" ||
               f.type == "enum" ||
               f.type == "asset" ) {
                 // because the id field is present
                 return true;
               }
          if ( f.type === "password" && data[f.slug] === null ) { return true; }
          //if ( f.type === "link" || f.type === "collection" ) { return true }
          if ( f.type === "string" && f.slug.match(/-key$/) ) { return false; }
          return !f.editable;
        }).map( function(f) { return f.slug; }).value();
      return _( data ).omit( blacklist );
    },
    // too much copy & paste here - refactor this from here
    // and from CollectionChooser
    selected: function() {
      var self = this;
      var selected = [];
      var _content = {};
      _( self.value ).each( function(c) { _content[ c.id ] = c; } );
      var ids = $("input[name=id]:checked").each( function(index, el) {
        selected.push(_content[ $(el).val() ]);
      });
      return selected;
    },
    command: function( command ) {
      var self = this;
      var selected = self.selected();
      // just do edit for now
      if (command === "edit") {
        if (selected.length === 0) {
          global.caribou.status.addErrorMessage(
            "You have to choose at least one!"
          ).render();
          return null;
        } else if (selected.length === 1) {
          return self.editExisting( selected[0] );
        }
        return self.bulkEdit( selected );
      }
      return null;
    },
    bulkEdit: function( values ) {
      var self = this;
      var editor = new BulkModelEditor({
        model: self.model,
        ids: _( values ).pluck("id"),
        submit: function( value, next ) {
          self.saveChanges( value, next );
        }
      });

      editor.load( function(data, error, jqxhr) {
        editor.template = data.template;
        editor.value = data.state;
        editor.syncToChildren();
        self.stack().push( editor );
      });
    },
    // end of nasty copy/paste.
    addNew: function() {
      var self = this;
      console.log("Adding new %s!", this.model.slug);
      var reciprocalField = self.reciprocalField();

      var value = {};
      if ( self.field.type === "collection" ) {
        value[reciprocalField.slug] = self.instance;
        value[reciprocalField.slug + "-id"] = self.instance.id;
      } else if ( self.field.type === "link" ) {
        value[reciprocalField.slug] = [ self.instance ];
      }

      var editor = global.caribou.editors.registry.editor({
        model: self.model,
        value: value,
        submit: function(value, next) {
          self.saveChanges(value, next);
        }
      });

      editor.load( function(data, error, xhr) {
        editor.template = data.template;
        self.stack().push(editor);
      });

      return false;
    },
    editExisting: function( existing ) {
      var self = this;
      var editor = global.caribou.editors.registry.editor({
        model: self.model,
        value: { id: existing.id },
        submit: function(value, next) {
          self.saveChanges(value, next);
        }
      });

      editor.load( function(data, error, xhr) {
        editor.template = data.template;
        editor.value = data.state;
        editor.syncToChildren();
        self.stack().push(editor);
      });
    },
    removeExisting: function( existing ) {
      var self = this;
      var removed = _( self.value ).find(function(c) {
        return c.id === existing.id;
      });
      if (removed) {
        console.log("Removing:", removed);

        global.caribou.models.post("remove-link", {
          model: self.parent.model.slug,
          field: self.field.slug,
          id: self.instance.id,
          "target-id": removed.id
        }, function(data) {
          self.refresh(function(data) {
            console.log(data);
            self.value = data.state;
          });
        });

      } else {
        console.log("Couldn't find " + existing.id);
      }
    },
    chooseExisting: function() {
      console.log("Choose existing");
      var self = this;
      var reciprocalField = self.reciprocalField();
      var chooser = new editors.CollectionChooser({
        multiple: true,
        model: self.model,
        current: self.value,
        submit: function( value, next ) {
          console.log("user chose ", value);
          if (!_.isArray(value) ) { value = [value]; };
          _(value).each( function(v) {
            if ( self.field.type === "collection" ) {
              v[reciprocalField.slug] = self.instance;
              v[reciprocalField.slug + "-id"] = self.instance.id;
            } else if ( self.field.type === "link" ) {
              v[reciprocalField.slug] = [ self.instance ];
            }
          });
          if (!self.instance.id) {
            self.value.concat( value );
            // complicated situation here if instance.id doesn't exist
            next( value );
          } else {
            self.saveChanges( value, next );
          }
        }
      });
      chooser.load( function(data, error, jqxhr) {
        chooser.template = data.template;
        self.stack().push( chooser );
      });
    },
    saveChanges: function( value, next ) {
      var self = this;
      var data = [];
      if (!_.isArray(value)) { value = [value]; }
      _( value ).each( function(v) {
        data.push({
          model: self.model.slug,
          fields: self.prepareForUpdate( v )
        });
      });
      self.api().post( data, function( d ) {
        console.log(d);
        self.load( function(data, error, jqxhr ) {
          self.value = data.state;
          self.template = data.template;
          global.caribou.status.addSuccessMessage(
            "Saved changes to " + self.model.slug + ": " +
            global.caribou.api.bestTitle( value, self.model.slug )
          );
          if (next) {
            next( value );
          }
        });
      });
    },
    attach: function() {
      var self = this;
      console.log("collection editor " + self.field.slug + " attaching");
      global.caribou.models.enableSorting();
      $( ".edit-link" ).click(function(e) {
        e.preventDefault();
        self.editExisting( $(this).data() );
      });
      $( ".delete-link" ).off("click").on("click", function(e) {
        e.preventDefault();
        global.caribou.models.showDeleteDialog(this, function(data) {
          self.refresh( function( data ) {
            self.value = data.state;
            self.syncToDOM();
          });
        });
      });
      if ( self.field.type === "link" ) {
        $( ".remove-link" ).off("click").on("click", function(e) {
          e.preventDefault();
          self.removeExisting( $(this).data() );
        }).show();
      }
      $(".pagination a").off("click").on("click", function(e) {
        e.preventDefault();
        self.page = $(this).data().page || 0;
        self.pageSize = $(this).data().size || self.defaultPageSize;
        self.refresh( function( data, error, jqxhr ) {
          console.log(
            "refreshed to page " + self.page +
              " size " + self.pageSize
          );
        });
      });
    }
  });

  function CollectionChooser( options ) {
    editors.Editor.call( this, options );
    // used for pagination
    this.page = 0;
    this.defaultPageSize = (
      global.caribou.config.pages.results['page-size'] || 20
    );
    this.pageSize = this.defaultPageSize;

    // the current state of this collection,
    // so we can highlight/identify which are already
    // present and which can be added
    this.current = options.current || [];
    var _currentIds = {};
    _( this.current ).each(function( c ) { _currentIds[ c.id ] = true; });
    this._currentIds = _currentIds;
    // can we choose more than one item?
    this.multiple = options.multiple || false;
  }
  $.extend( CollectionChooser.prototype, editors.Editor.prototype, {
    description: function() {
      var self = this;
      return "Choose " + self.model.name;
    },
    load: function( success ) {
      var self = this;
      var route = self.api().routeFor( "editor-content", {
        model: self.model.slug,
        template: "_paged_collection.html",
        page: self.page,
        size: self.pageSize
      });
      $.ajax({ url: route, success: function( data, error, jqxhr ) {
        self.loadContent( data.state );
        success( data, error, jqxhr );
      }});
    },
    loadContent: function( content ) {
      var self = this;
      self._content = {};
      _( content ).each( function(c) { self._content[ c.id ] = c; } );
    },
    selected: function() {
      var self = this;
      if (!self.multiple) { return null; }
      var selected = [];
      var ids = $("input[name=id]:checked").each( function(index, el) {
        selected.push(self._content[ $(el).val() ]);
      });
      return selected;
    },
    command: function( command ) {
      var self = this;
      var selected = self.selected();
      console.log("Applying command "+command, selected);
      // just do edit for now
      if (command === "edit") {
        if (selected.length === 0) {
          global.caribou.status.addErrorMessage(
            "You have to choose at least one!"
          ).render();
        } else if (selected.length === 1) {
          return self.editExisting( selected[0] );
        }
        return self.bulkEdit( selected );
      }
      return null;
    },
    // TODO:kd - combine the two following methods
    // or better, make ModelEditor a special case
    // of BulkModelEditor.
    editExisting: function( existing ) {
      var self = this;
      var editor = global.caribou.editors.registry.editor({
        model: self.model,
        value: { id: existing.id },
        submit: function( value, next ) {
          self.saveChanges( value, next );
        }
      });

      editor.load( function(data, error, jqxhr) {
        editor.template = data.template;
        editor.value = data.state;
        editor.syncToChildren();
        self.stack().push( editor );
      });
    },
    bulkEdit: function( values ) {
      var self = this;
      var editor = new editors.BulkModelEditor({
        model: self.model,
        ids: _( values ).pluck("id"),
        submit: function( value, next ) {
          self.saveChanges( value, next );
        }
      });

      editor.load( function(data, error, jqxhr) {
        editor.template = data.template;
        editor.value = data.state;
        editor.syncToChildren();
        self.stack().push( editor );
      });
    },
    saveChanges: function( value, next ) {
      var self = this;
      var data = [];
      if (!_.isArray(value)) { value = [value]; }
      _( value ).each( function(v) {
        data.push({
          model: self.model.slug,
          fields: self.prepareForUpdate( v )
        });
      });
      self.api().post( data, function( d ) {
        console.log(d);
        self.load( function(data, error, jqxhr ) {
          self.value = data.state;
          self.template = data.template;
          global.caribou.status.addSuccessMessage(
            "Saved changes to " + self.model.slug + ": " +
            global.caribou.api.bestTitle( value, self.model.slug )
          );
          if (next) { next( value ); }
        });
      });
    },
    attach: function() {
      // TODO:kd - little bit too much going on here now.
      var self = this;
      console.log("collection chooser " + self.model + " attaching");
      //global.caribou.models.enableSorting();
      $( ".edit-link" ).hide();
      $( ".delete-link" ).hide();
      if (self.multiple) {
        $( ".choose-link" ).hide().map(function(index, el) {
          var data = $(this).data();
          if ( self._currentIds[ data.id ] ) {
            $("input[type=checkbox][name=id][value=" + data.id + "]").hide();
          }
        });
      } else {
        $( ".choose-link" ).off("click").filter(function(index) {
          return !self._currentIds[ $(this).data().id ];
        }).on("click", function(e) {
          e.preventDefault();
          var id = $(this).data().id;
          self.value = self._content[ id ];
          $("#back-button").trigger("click");
        }).show();
      }
      $(".pagination a").off("click").on("click", function(e) {
        e.preventDefault();
        self.page = $(this).data().page || 0;
        self.pageSize = $(this).data().size || self.defaultPageSize;
        self.refresh( function( data, error, jqxhr ) {
          console.log("refreshed to page " + self.page +
                      " with size " + self.pageSize);
        });
      });
    },
    submit: function( next ) {
      var self = this;
      if (self.multiple) {
        self.value = self.selected();
      }
      self.callback("submit", next);
    }
  });

  function LinkFieldEditor( options ) {
    CollectionFieldEditor.call( this, options );
  }
  $.extend( LinkFieldEditor.prototype, CollectionFieldEditor.prototype, {});

  editors.CollectionFieldEditor = CollectionFieldEditor;
  editors.CollectionEditor = CollectionEditor;
  editors.CollectionChooser = CollectionChooser;
  editors.LinkFieldEditor = LinkFieldEditor;
})(window);
