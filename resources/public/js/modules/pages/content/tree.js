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
    this.serverValue = null;
    return this;
  };

  $.extend( TreeEditor.prototype, editors.Editor.prototype, {
    _makeNode: function( node ) {
      var self = this;
      //TODO Add correct path for route.
      return $('<li class="treenode" data-id="' + (node.id || "") + '"><span class="page-label">' + (node.label || "...") + '<span class="page-info">something/something/' + (node.label || "...") +'</span><span class="page-controls pull-right"><span class="instrument-icon-pencil"></span></span></span></li>');
    },
    instanceCount: 0,
    produce: function( dom, node ) {

      var self = this;
      var me = self._makeNode( node );
      if (node.children && node.children.length) {
        self.instanceCount++;
        var children = $('<ul class="page-subtree_' + self.instanceCount + '">');
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
      var dom = self.produce( $("<ul class=\"page-tree\">"), tree ); 

      if ( self.options.expands ) {
        $(dom).find("li.treenode").each( function(index, el) {
          var sub = $("ul", this);
          if (sub.size() > 0) {
            $(this).prepend( '<span class="instrument-icon-expand collapseable"></span>' );
// TODO Add plus icon to create a page under the selected node.
//            $(this).append('<span class="instrument-icon-circle-plus"></span>');
          } else {
            $(this).prepend('<span class="instrument-icon-expand collapseable hide"></span>');
//            $("page-controls").append('<span class="instrument-icon-circle-plus hide"></span>');
          }
        });

        $(dom).find('.collapseable').click( function() {
           if ($(this).hasClass('collapseable')) {
              var self = this;
              var subbranch = $('ul', this.parentNode).eq(0);
              if (subbranch.css('display') === 'none') {
                subbranch.show();
                $(this).addClass("instrument-icon-expand").removeClass("instrument-icon-collapse");
              } else {
                subbranch.hide();
                $(this).addClass("instrument-icon-collapse").removeClass("instrument-icon-expand");
              }
            }
        });
      }



      // TODO: should prune the tree first
      // sets up what's draggable
      $(dom).find("li.treenode").Draggable({
        revert: true,
        ghosting: true,
        start: function(event, ui) {
          $this.addClass('ui-draggable-dragging');
        }
      });
      // sets up what's droppable
      $(dom).find("span.page-label").Droppable({
        accept: "treenode",
        hoverclass: "dropOver",
        tolerance: "pointer",
        ondrop: function(dropped) {
          self.instanceCount++;
          console.log("Dropped: ", $(dropped).data());
          console.log("Onto: ", $(this).parent().data());
          if(this.parentNode === dropped) { return }
					var subbranch = $('ul', this.parentNode);
          var collapse = $('span', this.parentNode)
					if (subbranch.size() === 0) {
            instanceCount: 0,
						$(this).after('<ul class="page-subtree_' + self.instanceCount + '"></ul>');
						subbranch = $('ul', this.parentNode);
            collapse.removeClass('hide' );
					}
					oldParent = dropped.parentNode;
					subbranch.eq(0).append(dropped);
					oldBranches = $('li', oldParent);
					if (oldBranches.size() == 0) {
						$(oldParent).remove();
					}
        }
      });

      $(dom).find("span.instrument-icon-pencil").off("click").on("click", function(e) {
        e.preventDefault();
        var data = $(this).parent().parent().parent().data();
        console.log("Clicked on ", data);
        if ( self.options.select ) {
          self.options.select( data );
           var parentLI = $(this).parent().parent();
         $("span.active").removeClass("active");
         $(parentLI).addClass('active');
        }
      });
      $(self.selector).empty().append(dom);
    },

    arrange: function( content ) {
      var self = this;
      var nodesById = { 0: {
        parentId: null,
        id: 0,
        label: self.model.slug,
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

      // store the original
      self.serverValue = self.serverValue || global.caribou.api.deepClone( self.value );

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
    },
    submit: function( next ) {
      var self = this;
      self.syncFromDOM();
      var diff = global.caribou.api.difference( self.serverValue, self.value );

      // TODO handle complex diffs like additions and removals
      var diffs = [];
      _( diff ).map( function( value, key, all ) {
        var orig = self.serverValue[key][self.idKey] || null;
        value[self.idKey] = orig;
        diffs.push({ model: self.model.slug, fields: value });
      });
      console.log( "Submitting differences" );
      console.log( diffs );
      return diffs;
    }
  });

  editors.TreeEditor = TreeEditor;
})(window);
