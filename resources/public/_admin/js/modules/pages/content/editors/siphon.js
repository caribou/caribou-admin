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
    // override the default behaviour
    fieldIsEditable: function(field) {
      return field.editable || field.slug.match(/-key$/);
    },
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
    "||": true,
    "&&": true,
  };
  var SPEC_FIELD_OPERANDS = [ "&&", "||" ];
  var SPEC_FIELD_COMPARATORS = [ "=", "!=", ">", "<", "<=", ">=", "<>", "LIKE" ];

  // Handles the rendering and management of the "where" clause tree
  function SpecFieldWhereDelegate(options) {
    editors.TreeEditorDelegate.call(this, options);
  }

  $.extend( SpecFieldWhereDelegate.prototype, editors.TreeEditorDelegate.prototype, {
    nodeId: function(tree, node) {
      return node.id;
    },
    editor: function() {
      return this.options.editor;
    },
    makeNode: function(tree, node) {
      var self = this;
      var dom = $("<li>");

      var slugs = global.caribou.models.unrollFieldSlugs(self.options.editor.spec().model, 2);

      // build the icon container
      var iconContainer = $("<div class='icon-container'>");
      var icon = $("<span class='icon-collapsed'></span>");
      iconContainer.append(icon);

      var content = $("<div class='node-name'>");
      content.append(self.makeNodeEditor(tree, dom, node, slugs));

      var controlsContainer = $("<div class='controls-container'>");
      var controls = $("<span class='controls'>");
      controlsContainer.append(controls);

      return dom.append(iconContainer).append(content).append(controlsContainer);
    },
    makeNodeEditor: function(tree, dom, node, slugs) {
      var self = this;
      var nodeEditor = $("<span>");

      var comparisonContainer = $("<span class='comparison-container'>");
      if (SPEC_FIELD_OPERANDS_BY_OPERAND[node.operand]) {
        comparisonContainer.hide();
      }

      var keySelection = $("<select class='spec-comparison-key'>");
      keySelection.append("<option value=''></option>");

      _(slugs).each(function(s) {
        keySelection.append("<option>" + s + "</option>");
      });

      keySelection.on("change", function(e) {
        e.stopPropagation();
        node.key = keySelection.val();
        self.editor().refreshResults();
      });
      keySelection.sortOptionList();
      keySelection.val(node.key);

      var comparatorSelection = $("<select class='spec-comparison-comparator'>");
      _(SPEC_FIELD_COMPARATORS).each(function(c) {
        comparatorSelection.append("<option value='" + c + "'>" + c + "</option>");
      });
      comparatorSelection.val(node.operand);
      comparatorSelection.on("change", function(e) {
        e.stopPropagation();
        node.operand = comparatorSelection.val();
        self.editor().refreshResults();
      });

      var valueInput = $("<input type='text' class='spec-comparison-value'>");
      valueInput.val(node.value);
      valueInput.on("keyup change", function(e) {
        e.stopPropagation();
        node.value = valueInput.val();
        self.editor().refreshResults();
      });

      comparisonContainer.append(keySelection).append(comparatorSelection).append(valueInput);

      var nodeTypeSelection = $("<select class='spec-operand'>").
            append("<option value=\"&&\">AND</option>").
            append("<option value=\"||\">OR</option>").
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
        self.editor().refreshResults();
      });

      comparatorSelection.on("change", function(e) {
        e.stopPropagation();
        var v = comparatorSelection.val();
        node.operand = v;
        node.key = keySelection.val();
        node.value = valueInput.val();
        self.editor().refreshResults();
      });

      var negateCheckbox = $("<input type='checkbox' class='spec-negate'>");
      negateCheckbox.prop("checked", node.negate);
      negateCheckbox.on("change", function(e) {
        e.stopPropagation();
        node.negate = negateCheckbox.prop("checked");
        self.editor().refreshResults();
      });

      var negateSelection = $("<select class='spec-negate'>").append("<option value=''>").
                                          append("<option value='1'>NOT</option>");
      negateSelection.on("change", function(e) {
        e.stopPropagation();
        node.negate = (negateSelection.val() == 1);
        self.editor().refreshResults();
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

      nodeEditor.append(negateSelection).
                 append(nodeTypeSelection).
                 append(comparisonContainer);
                 //append("&nbsp;").
                 //append(negateCheckbox).
                 //append(" negate?");
      return nodeEditor;
    },
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
        self.addClause(tree, dom, node);
      });

      var removeClauseLink = self.newControl("-", function(e) {
        e.stopPropagation();
        self.removeClause(tree, dom, node);
      });

      controls.append(addClauseLink);
      if (node.parent && node.parent.children && node.parent.children.length > 1) {
        controls.append("&nbsp;").append(removeClauseLink);
      }
    },
    addLeafControls: function(tree, dom, node) {
      var self = this;
      return self.addNodeControls(tree, dom, node);
    },
    addClause: function(tree, dom, node) {
      var self = this;

      var newNode = {
        key: "",
        value: "",
        operand: "=",
        parent: node,
        negate: false,
        children: []
      };

      if (node.children.length === 0) {
        var currentNode = {
          key: node.key,
          operand: node.operand,
          value: node.value,
          parent: node,
          negate: node.negate,
          children: []
        };

        // change the current node to now be an AND node
        node.operand = "&&";
        node.key = null;
        node.value = null;
        node.children = [currentNode, newNode];
        node.negate = false;

        var newDom = tree.produce(node);
        dom.replaceWith(newDom);
      } else {
        node.children.push(newNode);
        var newDom = self.makeNode(tree, newNode).addClass("node");
        self.addNodeControls(tree, newDom, newNode);
        dom.find("ul:first").append(newDom);
      }
    },
    removeClause: function(tree, dom, node) {
      var self = this;
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
        parentNode.children = siblingNode.children;
        parentNode.negate = siblingNode.negate;
        _(parentNode.children).each(function(c) {
          c.parent = parentNode;
        });

        var newDom = tree.produce(parentNode);
        parentDom.replaceWith(newDom);
      }
    }

  });

  function SpecFieldEditor(options) {
    var self = this;
    global.caribou.api.invokeModels(); // load all the models
    editors.FieldEditor.call(this, options);

    self._showPreview = true;
    self._include = null;
    self._parameters = {};
    self._requiredParameters = [];
  }

  $.extend( SpecFieldEditor.prototype, editors.FieldEditor.prototype, {
    spec: function() {
      var self = this;
      if (!self.value) {
        self.value = {
          model: null,
          op: "gather",
          limit: null,
          offset: null,
          where: { "": {"=": ""} },
          include: {},
          order: [ {} ],
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

      // how many
      var useLimit = $("<input type='checkbox'>");
      useLimit.on("change", function(e) {
        e.stopPropagation();
        var specLimit = useLimit.parent().find(".spec-limit");
        if (!useLimit.prop("checked")) {
          specLimit.val("").trigger("change");
        }
      });

      var limitInput = $("<input type='text' placeholder='this many items' class='spec-limit' />").on("keyup change", function(e) {
        e.stopPropagation();
        var v = $(this).val();
        if (v > 0) {
          useLimit.prop("checked", true);
          if (self.spec().limit == 1) {
            self.spec().op = "pick";
          } else {
            self.spec().op = "gather";
          }
          self.spec().limit = v;
        } else {
          self.spec().limit = null;
        }
        self.refreshResults();
      });

      limitInput.val(self.spec().limit);
      var limit = [useLimit, " Limit search to ", limitInput];
      var where   = $("<h4>where</h4><div class='spec-where'></div>").hide();
      var order   = $("<h4>ordered by</h4><div class='spec-order'></div>").hide();
      var include = $("<h4>including</h4><div class='spec-include'></div>").hide();
      var preview = $("<h4>Preview</h4><div class='spec-preview-parameters'></div><div class='spec-preview'></div>");

      // Which model to fetch
      var modelSelection = $("<select class='spec-model'>");
      _(global.caribou.api.allModelSlugs()).each(function(slug) {
        modelSelection.append("<option value='" + slug + "'>" + global.caribou.api.model(slug).name + "</option>");
      });
      modelSelection.sortOptionList();
      modelSelection.prepend("<option value=''></option>");
      modelSelection.on("change", function(e) {
        var v = $(this).val();
        self.spec().model = v;

        if (v) {
          var m = global.caribou.api.model(v);
          var whereTree = new editors.TreeEditor({
            model: m,
            value: self.unrollWhere(self.spec().where),
            childRelationship: "children",
            leafRelationship: "kvps",
            parentRelationship: "parent",
            leafParentRelationship: "parent",
            delegate: new SpecFieldWhereDelegate({ editor: self })
          });
          whereTree.render(".spec-where").attach();
          self._whereTree = whereTree;
          where.show();

          var orderEditor = self.makeOrderEditor();
          self._element.find(".spec-order").empty().append(orderEditor);
          order.show();

          var includeEditor = self.makeIncludeEditor();
          var includeDom = self._element.find(".spec-include").empty();
          if (includeEditor) {
            includeDom.append(includeEditor);
            include.show();
          } else {
            include.hide();
          }

          self.refreshResults();
        } else {
          where.hide();
          order.hide();
          include.hide();
        }
      });

      // build editor HTML
      self.element().empty().
                     append("<h4>What</h4>").
                     append(modelSelection).
                     append(where).
                     append("<hr>").
                     append(limit).
                     append(order).
                     append(include).
                     append(preview);

      modelSelection.val(self.spec().model);
      modelSelection.trigger("change");
    },

    refreshParameterEditor: function(spec) {
      var self = this;

      self._element.find('.spec-preview-parameters').empty().
                    append(self.makeParameterEditor(spec));
    },

    refreshResults: function() {
      var self = this;

      var spec = self.generatePreviewSpec();

      var common = _.intersection(spec.parameters, self._requiredParameters);

      if (spec.parameters.length != self._requiredParameters.length ||
          common.length != spec.parameters.length ||
          common.length != self._requiredParameters.length) {
        self._requiredParameters = spec.parameters;
        self.refreshParameterEditor(spec);
      }

      if (spec.valid) {
        self.updatePreview(spec, function(data) {
          self._element.find('.spec-preview').empty().append(data.template);
        });
      } else {
        self._element.find('.spec-preview').empty();
      }
    },

    generatePreviewSpec: function() {
      var self = this;

      var spec = _(self.spec()).clone();
      spec.valid = true; // bad code smell here

      if (self._whereTree) {
        spec.where = self.rollUpWhere(self.pruneWhere(self._whereTree.value));
      } else {
        spec.valid = false;
      }
      spec.order = self.rollUpOrder(spec.order);
      spec.include = self.rollUpInclude(self._include);
      spec.limit = spec.limit || null;

      spec.parameters = self.extractParameters(spec);
      if (spec.parameters.length) {
        if (_(self._parameters).keys().length === spec.parameters.length) {
          var parameters = spec.parameters;
          delete spec.parameters;
          spec = self.applyParameters(spec);
          spec.parameters = parameters;
        } else {
          console.log("not enough parameters specified yet");
          spec.valid = false;
        }
      }
      return spec;
    },

    updatePreview: function(spec, f) {
      var self = this;
      delete spec.parameters;
      delete spec.valid;
      $.ajax({
        type: "POST",
        url: global.caribou.api.routeFor("find-with-siphon", {}),
        data: JSON.stringify({data: {spec: spec}}),
        contentType: "application/json; charset=utf-8",
        success: f
      });
    },

    extractParameters: function(spec) {
      var self = this;
      var parameters = [];

      _(spec).chain().keys().each(function(k) {
        var v = spec[k];

        if (k.match(/^:/)) {
          parameters.push(k);
        }

        if (_.isString(v) && v.match(/^:/)) {
          parameters.push(v);
        }

        if (v && typeof v === "object") {
          parameters = _.union(parameters, self.extractParameters(v));
        }
      });
      return parameters;
    },

    makeParameterEditor: function(spec) {
      var self = this;
      var editors = $("<ul class='spec-parameters'>");

      _(spec.parameters).each(function(p) {
        var editor = $("<input type='text'>").on("change keyup", function(e) {
          e.stopPropagation();
          self._parameters[p] = editor.val();
          self.refreshResults();
        });
        var item = $("<li>");
        item.append(p.replace(/^:/, "") + ":").append(editor);
        editors.append(item);
      });
      return editors;
    },

    applyParameters: function(spec) {
      var self = this;
      var newSpec = _.clone(spec);
      console.log(newSpec);
      var keys = _(newSpec).keys();
      _(keys).each(function (k) {
        if (k.match(/^:/)) {
          var v = self._parameters[k];
          newSpec[v] = newSpec[k];
          delete newSpec[k];
        } else if (newSpec[k] && typeof newSpec[k] === "object") {
          newSpec[k] = self.applyParameters(newSpec[k]);
        } else if (newSpec[k] && _.isString(newSpec[k]) && newSpec[k].match(/^:/)) {
          newSpec[k] = self._parameters[newSpec[k]];
        }
      });
      return newSpec;
    },

    newControl: function(text, f) {
      var control = $("<a href='#' class='table-link'>" + text + "</a>");
      if (f) {
        control.on("click", f);
      }
      return control;
    },

    makeOrderEditor: function() {
      var self = this;

      var slugs = global.caribou.models.unrollFieldSlugs(self.spec().model, 2);

      var editor = $("<div>");

      var editors = $("<ul>");
      $(self.spec().order).each(function(index, order) {
        editors.append(self.makeOrderEditorRow(order, slugs));
      });

      var removeLink = self.newControl("-", function(e) {
        e.stopPropagation();
        self.spec().order.pop();
        editors.find("li:last").remove();
        if (self.spec().order.length <= 1) {
          removeLink.hide();
          self.refreshResults();
        }
      });

      if (self.spec().order.length <= 1) {
        removeLink.hide();
      }

      var addLink = self.newControl("+", function(e) {
        e.stopPropagation();
        var newOrder = {};
        self.spec().order.push(newOrder);
        editors.append(self.makeOrderEditorRow(newOrder, slugs));
        removeLink.show();
        self.refreshResults();
      });


      var controls = $("<div class='spec-order-controls'>");
      controls.append(addLink).append("&nbsp;").append(removeLink);

      return editor.append(editors).append(controls);
    },

    makeOrderEditorRow: function(order, slugs) {
      var self = this;
      var editor = $("<li class='spec-order-editor'>");

      var key = _(order).keys()[0];

      var keySelection = $("<select>");
      keySelection.append("<option value=''></option>");

      _(slugs).each(function(s) {
        keySelection.append("<option>" + s + "</option>");
      });

      keySelection.on("change", function(e) {
        e.stopPropagation();
        var k = keySelection.val();
        var ck = _(order).keys()[0];
        order[k] = order[ck] || "asc";
        if (k !== ck) {delete order[ck]}
        self.refreshResults();
      });
      keySelection.sortOptionList();
      keySelection.val(key);

      var val = order[key];
      var directionSelection = $('<select>');
      directionSelection.append("<option value='desc'>Descending</option>");
      directionSelection.append("<option value='asc'>Ascending</option>");
      directionSelection.val(val);

      directionSelection.on("change", function(e) {
        e.stopPropagation();
        var v = directionSelection.val();
        var k = _(order).keys()[0];
        order[k] = v;
        self.refreshResults();
      });

      return editor.append(keySelection).append(directionSelection);
    },

    makeIncludeEditor: function() {
      var self = this;

      var slugs = global.caribou.models.unrollFieldSlugs(self.spec().model, 2, function(f) {
        return (f.type === "link" || f.type === "collection" || f.type === "part" );
      });

      if (slugs.length === 0) {
        return null;
      }

      // This is bad, don't do this - we need to do it because
      // we're using a list metaphor to edit the includes but
      // they need to be ultimately handled as a map.
      var includeMap = self.spec().include;
      var includeArray = self.unrollInclude(includeMap);
      if (includeArray.length === 0) {
        includeArray.push({key:""});
      }
      self._include = includeArray;

      var editor = $("<div>");

      var editors = $("<ul>");
      $(includeArray).each(function(index, include) {
        editors.append(self.makeIncludeEditorRow(include, slugs));
      });

      var removeLink = self.newControl("-", function(e) {
        e.stopPropagation();
        includeArray.pop();
        editors.find("li:last").remove();
        if (includeArray.length <= 1) {
          removeLink.hide();
          self.refreshResults();
        }
      });

      if (includeArray.length <= 1) {
        removeLink.hide();
      }

      var addLink = self.newControl("+", function(e) {
        e.stopPropagation();
        var newOrder = {};
        includeArray.push(newOrder);
        editors.append(self.makeIncludeEditorRow(newOrder));
        removeLink.show();
        self.refreshResults();
      });

      var controls = $("<div class='spec-include-controls'>");
      controls.append(addLink).append("&nbsp;").append(removeLink);
      return editor.append(editors).append(controls);
    },

    makeIncludeEditorRow: function(include, slugs) {
      var self = this;
      var editor = $("<li class='spec-include-editor'>");

      var keySelection = $("<select>");
      keySelection.append("<option value=''></option>");

      _(slugs).each(function(s) {
        keySelection.append("<option>" + s + "</option>");
      });

      keySelection.on("change", function(e) {
        e.stopPropagation();
        var v = keySelection.val();
        include.key = v;
        self.refreshResults();
      });
      keySelection.sortOptionList();
      keySelection.val(include.key);

      return editor.append(keySelection);
    },

    syncFromDOM: function() {
      var self = this;
      console.log("syncing from DOM");

      self.value.where = self.rollUpWhere(self.pruneWhere(self._whereTree.value));
      self.value.order = self.rollUpOrder(self.value.order);
      self.value.include = self.rollUpInclude(self._include);
    },

    // returns an unrolled tree built from a where clause
    unrollWhere: function(where, nodeCounter) {
      var self = this;
      nodeCounter = nodeCounter || 1;

      var node = {
        id: nodeCounter++,
        negate: false,
        children: []
      };

      if (where["!"]) {
        node.negate = true;
        where = where["!"];
      }

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
          node.operand = "&&";

          var v = where[k];
          var c = {};
          c[k] = v;
          var child = self.unrollWhere(c, nodeCounter);
          child.parent = node;
          node.children.push(child);
        }
      });
      return node;
    },

    rollUpWhere: function(w) {
      var self = this;
      // build pure structure from nodes
      var root = {};

      if (!w) { return root }

      // node is a not
      if (w.negate) {
        var negate = {
          children: w.children,
          key: w.key,
          value: w.value,
          operand: w.operand,
          negate: false
        };
        root["!"] = self.rollUpWhere(negate);
        return root;
      }

      // node is an and/or/not
      if (SPEC_FIELD_OPERANDS_BY_OPERAND[w.operand]) {
        var children = [];
        _(w.children).each(function(c) {
          var child = self.rollUpWhere(c);
          children.push(child);
        });
        root[w.operand] = children;
        return root;
      }

      // node is a comparison
      if (w.operand === "=") {
        root[w.key] = w.value;
        return root;
      }
      root[w.key] = {};
      root[w.key][w.operand] = w.value;
      return root;
    },


    rollUpOrder: function(o) {
      var self = this;
      var newOrder = [];
      if (!_.isArray(o)) { o = [o] }
      _(o).each(function(ordering) {
        var keys = _(ordering).keys();

        if (keys.length === 1 && keys[0]) {
          newOrder.push(ordering);
        }
      })
      return newOrder;
    },


    rollUpInclude: function(i) {
      var self = this;
      var includes = {};
      _(i).each(function(include) {
        var key = include.key;
        if (!key) { return }
        var bits = key.split(/\./);
        var c = includes;
        while(bits.length) {
          var k = bits.shift();
          c[k] = c[k] || {};
          c = c[k];
        }
      });
      return includes;
    },


    unrollInclude: function(i) {
      var self = this;
      var includes = [];

      _(i).each(function(v, k) {
        if (_(v).keys().length === 0) {
          includes.push({ key: k });
        } else {
          var keys = self.unrollInclude(v);
          _(keys).each(function(key) {
            includes.push({ key: k + "." + key });
          });
        }
      });

      return includes;
    },


    pruneWhere: function(w) {
      var self = this;

      // if it's an empty node, return
      if (!w.key && !w.value && !SPEC_FIELD_OPERANDS_BY_OPERAND[w.operand]) { return }

      // prune the children
      var children = [];
      _(w.children).each(function(c) {
        var child = self.pruneWhere(c);
        if (!child) { return }
        child.parent = w;
        children.push(child);
      });
      w.children = children;

      if (SPEC_FIELD_OPERANDS_BY_OPERAND[w.operand] && w.children && w.children.length === 1) {
        var child = w.children[0];
        child.parent = null;
        return child;
      }
      return w;
    }
  });

  global.caribou.editors.registry.register("siphon", SiphonEditor);
  global.caribou.editors.SiphonEditor = SiphonEditor;
  global.caribou.editors.SpecFieldEditor = SpecFieldEditor;
})(window);
