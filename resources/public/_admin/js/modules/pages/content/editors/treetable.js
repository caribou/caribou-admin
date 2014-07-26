// This requires editors/base.js to have been included first.

(function(global) {
  var editors = global.caribou.editors;
  if (!editors) {
    throw "editors/base.js has not been included";
  }

  // Subclass/override to provide your own
  // delegate to handle tree events
  var TreeEditorDelegate = function() {};
  TreeEditorDelegate.prototype = {
    labelFor: function() { return ""; },
    select: function() { return ""; },
    addControls: function() {},
    removeControls: function() {},
    update: function () {},
    makeNode: function( node ) {
      var self = this;
      return $('<tr data-id="' + (node.id || "0") +
               '" data-parent-id="' + (node.parentId || "") + '">' +
               '<td>' + node.label + '</td></tr>');
    },
    makeHeader: function() {}
  };


  var TreeEditor = function( options ) {
    editors.Editor.call( this, options );

    // these properties can be overridden in options
    // but in general the defaults will suffice
    this.parentIdKey = options.parentIdKey || "parent-id";
    this.idKey       = options.idKey       || "id";
    this.labelKey    = options.labelKey    || "name";
    this.rootLabel   = options.rootLabel   || "/";
    this.delegate    = options.delegate || new TreeEditorDelegate();
    this.serverValue = null;
    return this;
  };

  $.extend( TreeEditor.prototype, editors.Editor.prototype, {
    produce: function( dom, node ) {
      var self = this;
      var me = self.delegate.makeNode( node );
      dom.append(me);
      if (node.children && node.children.length) {
        _( node.children ).each( function(c) {
          self.produce( dom, c );
        });
      }
      return dom;
    },
    attach: function() {
      var self = this;
      self.tree = this.arrange( self.value || [] );
      var tree = self.tree[0];
      var dom = self.produce( $("<table class='table-striped'>"), tree );
      dom.prepend( self.delegate.makeHeader() );

      $( self.selector ).empty().append( dom );

      // turn it into a tree:

      $( self.selector ).find("table:first").treetable({
        expandable: false,
        initialState: "expanded",
        nodeIdAttr: "id",
        parentIdAttr: "parentId"
      });

      $( self.selector ).find("tr").each( function( index, item ) {
        var data = $(item).data();
        var node = self.tree[data.id];
        self.delegate.addControls( self, item, node);
      });

      $( self.selector + " .treenode" ).draggable({
        helper: "clone",
        opacity: .75,
        refreshPositions: true,
        revert: "invalid",
        revertDuration: 300,
        scroll: true
      });

      $( self.selector + " .treenode" ).each(function() {
        $(this).parents("tr:first").droppable({
          accept: ".treenode",
          drop: function(e, ui) {
            var dropped = ui.draggable.parents("tr:first");
            // verify that it can be dropped on $(this)
            if (self.isDescendentOf($(this).data("id"), dropped.data("id"))) {
              console.log("can't drop onto a child of itself");
              return;
            }
            $( self.selector + " table:first")
              .treetable("move", dropped.data( "id" ),
                         $(this).data( "id" ));
            dropped.data().parentId = $(this).data().id;
            self.syncFromDOM();
            var diffs = self.diffs();
            //console.log(diffs);
            self.delegate.update( self, diffs );
          },
          hoverClass: "accept"
        });
      });
    },

    arrange: function( content ) {
      var self = this;
      // any id of zero needs to be translated to a nil before being
      // committed to the server
      var nodesById = { 0: {
        parentId: null,
        id: 0,
        label: self.rootLabel || self.model.slug,
        children: [],
        node: { id: 0 }
      } };
      _( content ).each( function(c) {
        var key = c[self.idKey];
        nodesById[key] = {
          id: c[self.idKey],
          parentId: c[self.parentIdKey],
          label: c[self.labelKey],
          children: [],
          node: c
        };
      });
      _( nodesById ).chain().values().each( function(v) {
        if ( v.id === 0 ) { return; }
        var parent = nodesById[v.parentId || 0];
        if (!parent) { parent = nodesById[0]; }
        parent.children.push(v);
        v.parent = parent;
      });
      return nodesById;
    },

    syncFromDOM: function() {
      var self = this;

      // store the original
      self.serverValue = (
        self.serverValue || global.caribou.api.deepClone( self.value )
        );

      var pairs = [];
      $( self.selector )
        .find("table:first")
        .find("tr")
        .has("td")
        .each( function() {
          var el = $(this);
          var pair = {
            id: el.data().id || null,
            parentId: el.data().parentId || null
          };
          pairs.push(pair);
        });
      _( pairs ).each( function(p) {
        var node = self.tree[p.id || 0].node;
        if (!node) { console.log("Node with id %d not found", p.id); return }
        var currentParentId = (node[self.parentIdKey] || 0);
        if ( currentParentId != (p.parentId || 0) ) {
          console.log("Updating parent for <%s> from <%d> to <%d>",
                      p.label,
                      currentParentId,
                      p.parentId );
          console.log(node);
          node[self.parentIdKey] = p.parentId;
        }
      });
    },
    diffs: function() {
      var self = this;
      var diff = global.caribou.api.difference( self.serverValue, self.value );
      // TODO handle complex diffs like additions and removals
      var diffs = [];
      _( diff ).map( function( value, key, all ) {
        var orig = self.serverValue[key][self.idKey] || null;
        value[self.idKey] = orig;
        diffs.push({ model: self.model.slug, fields: value });
      });
      return diffs;
    },
    submit: function( next ) {
      var self = this;
      self.syncFromDOM();
      var diffs = self.diffs();

      self.delegate.update(self, diffs);

      if (next) {
        return next( diffs );
      }
      return diffs;
    },
    isDescendentOf: function( human, ape ) {
      var self = this;
      if (human == ape) { return true }
      if (!self.tree[human].parentId) { return false }
      return self.isDescendentOf( self.tree[human].parentId, ape );
    }
  });

  editors.TreeTableEditor = TreeEditor;
  editors.TreeTableEditorDelegate = TreeEditorDelegate;
})(window);

