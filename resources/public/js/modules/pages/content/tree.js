// This requires editors.js to have been included first.

(function(global) {
  var editors = global.caribou.editors;
  if (!editors) {
    throw "editors.js has not been included";
  }

  var TreeEditor = function( options ) {
    editors.Editor.call( this, options );

    // these properties can be overridden in options
    // but in general the defaults will suffice
    this.parentIdKey = options.parentIdKey || "parent_id";
    this.idKey       = options.idKey       || "id";
    this.labelKey    = options.labelKey    || "name";

    return this;
  };

  $.extend( TreeEditor.prototype, editors.Editor.prototype, {
    _makeNode: function( node ) {
      var self = this;
      return $('<li class="treenode" data-id="' + (node.id || "") + '"><span>' + (node.label || "...") + '</span></li>');
    },
    produce: function( dom, node ) {
      var self = this;
      var me = self._makeNode( node );
      if (node.children && node.children.length) {
        var children = $('<ul>');
        _( node.children ).each( function(c) {
          self.produce( children, c );
        });
        me.append( children );
      }
      dom.append(me);
      return dom;
    },
    attach: function() {
      var self = this;
      self._tree = this.arrange( self.value || [] );
      var tree = self._tree[0];
      var dom = self.produce( $("<ul>"), tree ); 

      // TODO: should prune the tree first
      // sets up what's draggable
      $(dom).find("li.treenode").Draggable({ revert: true, autoSize: true, ghosting: true }); 

      // sets up what's droppable
      $(dom).find("span").Droppable({
        accept: "treenode",
        hoverclass: "dropOver",
        tolerance: "pointer",
        ondrop: function(dropped) {
          console.log("Dropped: ", $(dropped).data());
          console.log("Onto: ", $(this).parent().data());
          if(this.parentNode == dropped) { return }
					var subbranch = $('ul', this.parentNode);
					if (subbranch.size() == 0) {
						$(this).after('<ul></ul>');
						subbranch = $('ul', this.parentNode);
					}
					oldParent = dropped.parentNode;
					subbranch.eq(0).append(dropped);
					oldBranches = $('li', oldParent);
					if (oldBranches.size() == 0) {
						$(oldParent).remove();
					}
        }
      });

      $(self.selector).empty().append(dom);
    },

    arrange: function( content ) {
      var self = this;
      var nodesById = { 0: {
        parentId: null,
        id: 0,
        label: "wtf",
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
        if ( v.id === 0 ) { return }
        var parent = nodesById[v.parentId || 0];
        if (!parent) { parent = nodesById[0] }
        parent.children.push(v);
      });
      return nodesById;
    },

    syncFromDOM: function() {
      var self = this;
      var pairs = [];
      $( self.selector ).find("li").each( function( index, el ) {
        var el = $(el);
        var pair = {};
        pair.id = el.data().id;
        pair.parentId = el.parent().parent().data().id || null;
        pair.label = el.find("span:first").text();
        pairs.push(pair);
      });
      _( pairs ).each( function(p) {
        var node = self._tree[p.id || 0].node;
        if (!node) { console.log("Node with id %d not found", p.id); return }
        var currentParentId = (node[self.parentIdKey] || 0);
        if ( currentParentId != (p.parentId || 0) ) {
          console.log("Updating parent for <%s> from <%d> to <%d>", p.label, currentParentId, p.parentId );
          console.log(node);
          node[self.parentIdKey] = p.parentId;
        }
      });
      console.log( JSON.stringify( pairs ) );
    }
  });

  editors.TreeEditor = TreeEditor;
})(window);
