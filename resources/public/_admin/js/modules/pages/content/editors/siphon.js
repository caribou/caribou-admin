(function (global) {
  global.caribou = global.caribou || {};
  var editors = global.caribou.editors;
  if (!editors) {
    throw "editors/base.js and editors/fields.js have not been included";
  }

  function SiphonEditor(options) {
    editors.ModelEditor.call(this, options);
  }

  $.extend( SiphonEditor.prototype, editors.ModelEditor.prototype, {
    constructChild: function(field) {
      var self = this;
      if (field.slug === "spec") {
        console.log("Constructing spec field");

        var editor = new SpecFieldEditor({
          model: self.model,
          field: field,
          parent: self,
          value: self.get( field.slug ),
          sync: function( value, next ) { self.syncFromChild( editor, value, next ); }
        });
        return editor;
      }
      return editors.ModelEditor.prototype.constructChild.call(self, field);
    }
  });

  var SPEC_FIELD_OPERANDS_BY_OPERAND = {
    "'or": true,
    "'and": true,
    "'not": true
  };
  var SPEC_FIELD_OPERANDS = [ "'and", "'or", "'not" ];
  var SPEC_FIELD_COMPARATORS = [ "=", "!=", ">", "<", "<=", ">=", "<>", "LIKE" ];

  // Handles the rendering and management of the "where" clause tree
  function SpecFieldWhereDelegate(options) {
    editors.TreeEditorDelegate.call(this, options);
  }

  $.extend( SpecFieldWhereDelegate.prototype, editors.TreeEditorDelegate.prototype, {
    nodeId: function(tree, node) {
      return (node.category? "asset":"category") + "-" + node.id;
    },
    makeNode: function(tree, node) {
      var self = this;
      //if (!node.parent) {
      //  return this.makeHeader(tree, node);
      //}
      var dom = $("<li>");

      // build the icon container
      var iconContainer = $("<div class='icon-container'>");
      var icon = $("<span class='icon-collapsed'></span>");
      iconContainer.append(icon);

      var content = $("<div class='node-name'>");
      content.append(self.makeNodeEditor(tree, dom, node));
      //content.append((node.key || "") + node.operand + (node.value || ""));

      var controlsContainer = $("<div class='controls-container'>");
      var controls = $("<span class='controls'>");
      controlsContainer.append(controls);

      return dom.append(iconContainer).append(content).append(controlsContainer);
    },
    makeNodeEditor: function(tree, dom, node) {
      var self = this;
      var nodeEditor = $("<span>");

      var comparisonContainer = $("<span class='comparison-container'>");
      if (SPEC_FIELD_OPERANDS_BY_OPERAND[node.operand]) {
        comparisonContainer.hide();
      }

      var keyInput = $("<input type='text'>");
      keyInput.val(node.key);

      var comparatorSelection = $("<select>");
      _(SPEC_FIELD_COMPARATORS).each(function(c) {
        comparatorSelection.append("<option value='" + c + "'>" + c + "</option>");
      });
      comparatorSelection.val(node.operand);

      var valueInput = $("<input type='text'>");
      valueInput.val(node.value);

      comparisonContainer.append(keyInput).append(comparatorSelection).append(valueInput);

      var nodeTypeSelection = $("<select>").
            append("<option value=\"'and\">all of these are true</option>").
            append("<option value=\"'or\">any of these are true</option>").
            append("<option value=\"'not\">none of these are true</option>").
            val(node.operand);

      nodeTypeSelection.on("change", function(e) {
        e.stopPropagation();
        var v = nodeTypeSelection.val();
        if (!v) {
          comparisonContainer.show();
          tree.forceClosed(dom, node);
        } else {
          comparisonContainer.hide();
          tree.forceOpen(dom, node);
          delete node.key;
          delete node.value;
        }
        node.operand = v;
      });

      comparatorSelection.on("change", function(e) {
        e.stopPropagation();
        var v = comparatorSelection.val();
        node.operand = v;
        node.key = keyInput.val();
        node.value = valueInput.val();
      });

      if (self.hasChildren(tree, dom, node)) {
        nodeTypeSelection.show();
        comparatorSelection.hide();
        tree.forceOpen(dom, node);
      } else {
        nodeTypeSelection.hide();
        comparatorSelection.show();
        tree.forceClosed(dom, node);
      }

      nodeEditor.append(nodeTypeSelection).append(comparisonContainer);
      return nodeEditor;
    },
    /*
    makeLeaf: function(tree, node) {
      var dom = $("<li>");
      dom.append("<div class='icon-container'></div><div class='node-name'>" +
                 node.key + " " + node.comparator + " " + node.value +
                 "</div><div class='controls-container'><span class='controls'></span></div></div>");
      return dom;
    },
    makeHeader: function(tree, node) {
      var dom = $("<li>");
      dom.append("<div class='tree-header'><div class='icon-container'>&nbsp;</div><div class='node-name'>Op</div>" +
                 "<div class='controls-container'>Controls</div></div>");
      return dom;
    },
    */
    makePlaceholder: function(tree, droppedEl, onEl) {
      var dom = $("<li class='tree-placeholder'></li>");
      return dom;
    },
    nodeType: function(self, node) { return node.type },
    makeSubtree: function(self) { return $("<ul>") },
    openBranch: function(self, dom, node) {
      console.log("open branch");
      console.log(dom, node);
    },
    closeBranch: function(self, dom, node) {
      console.log("close branch");
      console.log(dom, node);
    },
    moveNode: function(self, dropped, on) {},
    moveLeaf: function(self, dropped, on) {},
    newControl: function(text, f) {
      var control = $("<a href='#' class='table-link'>" + text + "</a>");
      if (f) {
        control.on("click", f);
      }
      return control;
    },
    addNodeControls: function(tree, dom, node) {
      var self = this;

      var controls = dom.find(".controls");

      var addClauseLink = self.newControl("+", function(e) {
        e.stopPropagation();
        console.log("Add a subclause");
      });

      var removeClauseLink = self.newControl("-", function(e) {
        e.stopPropagation();
        console.log("Remove a subclause");
        var parentDom = dom.parents("li:first");
        var parentNode = node.parent;

        // TODO what happens if this is the root?
        dom.remove();
        parentNode.children = _(parentNode.children).without(node);

        if (parentNode.children.length === 1) {
          console.log("Only one clause left, promoting...")
          var siblingDom = parentDom.find("li:first");
          var siblingNode = parentNode.children[0];

          // TODO copy is silly but is there a better way?
          parentNode.key = siblingNode.key;
          parentNode.operand = siblingNode.operand;
          parentNode.value = siblingNode.value;
          parentNode.children = [];

          var newDom = self.makeNode(tree, parentNode);
          self.addNodeControls(tree, newDom, parentNode);
          parentDom.replaceWith(newDom);
        }
      });

      controls.append(addClauseLink).append("&nbsp;").append(removeClauseLink);
    },
    addLeafControls: function(tree, dom, node) {
      var self = this;
      return self.addNodeControls(tree, dom, node);
    }
  });

  function SpecFieldEditor(options) {
    var self = this;
    // load all the models
    global.caribou.api.invokeModels();

    editors.StructureFieldEditor.call(this, options);
  }

  $.extend( SpecFieldEditor.prototype, editors.StructureFieldEditor.prototype, {
    spec: function() {
      var self = this;
      if (!self.value) {
        self.value = {
          model: null,
          op: "gather",
          limit: null,
          offset: null,
          where: {"'and": [ {"'or": [{"foo":3}, {"bar": {">":2}}]}, {"bar":4} ]},
          include: {},
          order: {}
        };
      }
      return self.value;
    },
    selector: function() { return "." + this.model.slug + "-" + this.field.slug },

    // Attach builds the editor, attaches the handlers.
    // It's kind of janky to build it this way but it works
    // and doesn't require any server-side magic.
    attach: function() {
      var self = this;

      // Which operation
      var operation = $("<select class='spec-op'>").on("change", function(e) {
        var v = $(this).val();
        self.spec().op = v;
      });
      operation.append("<option value='gather'>Gather</option");
      operation.append("<option value='pick'>Pick</option");
      operation.val(self.spec().op);

      // how many
      var limit = $("<input type='text' placeholder='this many items' class='spec-limit' />").on("keyup change", function(e) {
        e.stopPropagation();
        self.spec().limit = $(this).val();
      });

      // Which model to fetch
      var modelSelection = $("<select class='spec-model'>").on("change", function(e) {
        var v = $(this).val();
        self.spec().model = v;
      });
      _(global.caribou.api.allModelSlugs()).each(function(slug) {
        modelSelection.append("<option value='" + slug + "'>" + global.caribou.api.model(slug).name + "</option>");
      });
      modelSelection.sortOptionList();
      modelSelection.val(self.spec().model);

      var offset = $("<input type='text' placeholder='this many items' class='spec-limit' />").on("caribou:change", function(e) {
        e.stopPropagation();
        self.spec().limit = $(this).val();
      });

      var where = $("<div class='spec-where'>");

      // build editor HTML
      self.element().append(operation).
                     append(limit).
                     append("of type").
                     append(modelSelection).
                     append("where:<br />").
                     append(where);

      // crappy
      var whereTree = new editors.TreeEditor({
        model: null,
        value: self.unrollWhere(self.spec().where),
        childRelationship: "children",
        leafRelationship: "kvps",
        parentRelationship: "parent",
        leafParentRelationship: "parent",
        delegate: new SpecFieldWhereDelegate()
      });
      whereTree.render(".spec-where").attach();
    },
    syncToDOM: function() {
    },
    syncFromDOM: function() {
    },

    // returns an unrolled tree built from a where clause
    unrollWhere: function(where, nodeCounter) {
      var self = this;
      nodeCounter = nodeCounter || 1;

      var node = {
        id: nodeCounter++,
        children: []
      };

      var keys = _(where).keys();

      if (keys.length === 1) {
        var k = keys[0];
        if (!SPEC_FIELD_OPERANDS_BY_OPERAND[k]) {
          v = where[k];
          var value = null;
          var comparator = null;

          if (typeof v === "object") {
            comparator = _(SPEC_FIELD_COMPARATORS).find(function(c) { return v.hasOwnProperty(c) });
            if (comparator) {
              value = v[comparator];
            } else {
              console.log("Unknown spec format: " + JSON.stringify(v));
            }
          } else {
            comparator = "=";
            value = v;
          }
          node.key = k;
          node.operand = comparator;
          node.value = value;
          return node;
        }
      }

      _(where).chain().keys().each(function(k) {
        if (SPEC_FIELD_OPERANDS_BY_OPERAND[k]) {
          node.operand = k;
          _(where[k]).each(function(c) {
            var child = self.unrollWhere(c, nodeCounter);
            child.parent = node;
            node.children.push(child);
          });
        } else {
          // node has naked key/values, so it's an AND
          node.operand = "'and";

          var v = where[k];
          var c = {};
          c[k] = v;
          var child = self.unrollWhere(c, nodeCounter);
          child.parent = node;
          node.children.push(child);
        }
      });
      return node;
    }
  });

  global.caribou.editors.registry.register("siphon", SiphonEditor);
  global.caribou.editors.SiphonEditor = SiphonEditor;
  global.caribou.editors.SpecFieldEditor = SpecFieldEditor;
})(window);
