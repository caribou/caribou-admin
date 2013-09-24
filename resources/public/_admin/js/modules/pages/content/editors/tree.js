// This requires editors.js to have been included first.
(function(global) {
    var editors = global.caribou.editors;
    if (!editors) {
        throw "editors.js has not been included";
    }

    var TreeEditorDelegate = function(options) {
      this.options = options;
    };
    $.extend(TreeEditorDelegate.prototype, {
        makeNode: function(self, node, root) {
            return $("<li data-id='" + node.id + "'><span class='icon-collapsed'></span>" + node.id + "</li>");
        },
        nodeId: function(self, node) { return node.id },
        nodeType: function(self, node) { return node.type },
        hasChildren: function(tree, dom, node) {
            var children = node[tree.childRelationship] || [];
            var leaves = node[tree.leafRelationship] || [];
            return (children.length + leaves.length > 0)
        },
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
        addNodeControls: function() {},
        addLeafControls: function() {}
    });

    var TreeEditor = function(options) {
        editors.Editor.call(this, options);
        this.delegate = options.delegate || new TreeEditorDelegate();
        this.needsRender = true;
        this.childRelationship      = options.childRelationship || "children";
        this.leafRelationship       = options.leafRelationship  || "leaves";
        this.parentRelationship     = options.parentRelationship     || "parent";
        this.leafParentRelationship = options.leafParentRelationship || "parent";
        this.openClass              = options.openClass || "open";
        this.closedClass            = options.closedClass || "closed";
        this.treeClass              = options.treeClass || "tree";
        this.openState = options.openState || {};
        if (options.openTo) {
            this.openTo(options.openTo);
        }
    };

    $.extend(TreeEditor.prototype, editors.Editor.prototype, {
        render: function(selector) {
            var self = this;
            self.selector = selector;
            if (!this.needsRender) { return }
            var root = self.value;
            var tree = self.delegate.makeSubtree(self);
            tree.addClass(self.treeClass);
            var dom = tree.append(self.produce(root));
            $(selector).empty().append(dom);
            self.element = dom;
            return self; // so you can do render().attach()
        },
        attach: function() {
            var self = this;
            var dom = self.element;
            self.addDragHandler(dom, self.value);
            self.addDropHandler(dom, self.value);
            self.delegate.openBranch(self, dom, self.value);
        },
        openTo: function(node) {
            var self = this;
            var openState = this.openState;
            var current = node;
            while (current.parent) {
                openState[self.delegate.nodeId(self, current)] = true;
                current = current.parent;
            }
        },
        newSubtree: function() {
            return this.delegate.makeSubtree(self);
        },
        isOpen: function(node) {
            if (node.id === null) {
                return true; // the root is always open
            }
            var nodeId = this.delegate.nodeId(self, node);
            return this.openState[nodeId] || false;
        },
        produce: function(data) {
            var self = this;

            // this node of the tree rendered as a DOM node
            var dom = self.delegate.makeNode(self, data, self.value).addClass("node");
            dom.data().node = data;
            self.delegate.addNodeControls(self, dom, data);

            if (self.isOpen(data)) {
                dom.addClass(self.openClass);
            } else {
                dom.removeClass(self.openClass);
            }

            self.addOpenHandler(dom, data);

            // children of this node
            var children = data[self.childRelationship];

            var childCount = 0;
            var subtree = self.newSubtree();
            if ( (children && children.length)
              || (self.leafRelationship && data[self.leafRelationship] && data[self.leafRelationship].length) ) {

                if (children && children.length) {
                    for (var i=0; i < children.length; i++) {
                        var sub = self.produce(data[self.childRelationship][i]);
                        sub.data().node = data[self.childRelationship][i];
                        subtree.append(sub);
                        childCount++;
                    }
                }
                if (self.leafRelationship) {
                    var leaves = data[self.leafRelationship];
                    if (leaves && leaves.length) {
                        for (var i=0; i < leaves.length; i++) {
                            var leaf = self.delegate.makeLeaf(self, data[self.leafRelationship][i], self.value).addClass('leaf');
                            self.delegate.addLeafControls(self, leaf, data[self.leafRelationship][i]);
                            leaf.data().node = data[self.leafRelationship][i];
                            subtree.append(leaf);
                            childCount++;
                        }
                    }
                }
            }
            dom.append(subtree);

            if (childCount === 0) {
                dom.find("span.icon-collapsed").hide();
            }

            if (self.openState[self.delegate.nodeId(self, data)]) {
                dom.find(".icon-collapsed:first").removeClass('icon-collapsed').addClass('icon-expand');
            }
            return dom;
        },
        addOpenHandler: function(dom, node) {
            var self = this;
            dom.find('.node-name, .icon-collapsed, .icon-expand').off("click").on("click", function(e) {
                e.stopPropagation();
                self.toggleOpenState(dom, node);
            });
        },
        forceOpen: function(dom, node) {
            var self = this;
            if (!self.hasChildren(dom, node)) {
                return;
            }
            dom.addClass(self.openClass);
            self.openState[self.delegate.nodeId(self, node)] = true;
            self.delegate.openBranch(self, dom, node);
            dom.find("span:first").addClass("icon-expand").removeClass("icon-collapsed").show();
        },
        forceClosed: function(dom, node) {
            var self = this;
            dom.removeClass(self.openClass);
            self.openState[self.delegate.nodeId(self, node)] = false;
            self.delegate.closeBranch(self, dom, node);
            dom.find("span:first").addClass("icon-collapsed").removeClass("icon-expand").show();
        },
        toggleOpenState: function(dom, node) {
            var self = this;
            if (!self.hasChildren(dom, node)) {
                return;
            }
            dom.toggleClass(self.openClass);
            var currentOpenState = self.openState[self.delegate.nodeId(self, node)];
            if (currentOpenState) {
                self.delegate.closeBranch(self, dom, node);
                dom.find(".icon-expand:first").addClass("icon-collapsed").removeClass("icon-expand").show();
            } else {
                self.delegate.openBranch(self, dom, node);
                dom.find(".icon-collapsed:first").addClass("icon-expand").removeClass("icon-collapsed").show();
            }
            self.openState[self.delegate.nodeId(self, node)] = !currentOpenState;
        },
        hasChildren: function(dom, node) {
            var self = this;
            return self.delegate.hasChildren(self, dom, node);
        },
        addDragHandler: function(dom) {
            var self = this;
            dom.find(".node, .leaf").draggable({
                helper: "clone",
                opacity: .75,
                refreshPositions: true,
                revert: "invalid",
                revertDuration: 300,
                scroll: true
            });
        },
        addDropHandler: function(dom) {
            var self = this;
            return;
            /*
            // TODO make this configurable
            dom.find(".node > .node-name").droppable({
                accept: ".node, .leaf",
                hoverClass: "ui-state-hover",
                tolerance: "pointer",
                drop: function(e, ui) {
                    var onEl = $(this);
                    var parentEl = onEl.parents("li:first");
                    var droppedEl = $(ui.draggable);
                    var from = droppedEl.parents("li:first");
                    var fromNode = from.data().node;
                    onEl.prev(".tree-placeholder").remove();
                    self.dropNode(droppedEl, parentEl);
                    self.forceOpen(parentEl, parentEl.data().node);
                    parentEl.find("ul:first").prepend(droppedEl);
                    if ((!fromNode.children || fromNode.children.length === 0) &&
                        (!fromNode.pages || fromNode.pages.length === 0)) {
                        from.find(".icon-expand:first").addClass("icon-collapsed").removeClass("icon-expand").hide();
                        self.openState[self.delegate.nodeId(self, fromNode)] = false;
                    }
                },
                over: function(e, ui) {
                    console.log("over");
                     var droppedEl = $(ui.draggable);
                     var onEl = $(this);
                     var parentEl = onEl.parents("li:first");

                     // var placeholderNode = self.delegate.makePlaceholder(self, droppedEl, onEl);
                     // parentEl.before(self.enablePlaceholder(placeholderNode));
                     if(this != droppedEl[0] && !parentEl.is(".open")) {
                         var on = parentEl.data().node;
                         console.log(parentEl, on);
                         self.toggleOpenState(parentEl, on);
                     }
                },
                out: function(e, ui) {
                    var droppedEl = $(ui.draggable);
                    var onEl = $(this);
                    var parentEl = onEl.parents("li:first");
                    onEl.prev(".tree-placeholder").remove();
                }
            });
            dom.find(".leaf").droppable({
                accept: ".leaf",
                hoverClass: "ui-state-hover",
                tolerance: "pointer",
                drop: function(e, ui) {
                    var onEl = $(this);
                    console.log("leaf on leaf action");
                    var droppedEl = $(ui.draggable);
                    self.dropNode(droppedEl, onEl);
                    onEl.prev(".tree-placeholder").remove();
                    onEl.before(droppedEl);
                },
                over: function(e, ui) {
                    var droppedEl = $(ui.draggable);
                    //console.log("leaf is over ", droppedEl.data().node);
                    var onEl = $(this);
                    var parentEl = onEl.parents("li:first");
                    var placeholderNode = self.delegate.makePlaceholder(self, droppedEl, onEl);
                    placeholderNode.addClass("tree-placeholder");
                    onEl.before(placeholderNode);
                },
                out: function(e, ui) {
                    var droppedEl = $(ui.draggable);
                    var onEl = $(this);
                    var parentEl = onEl.parents("li:first");
                    onEl.prev(".tree-placeholder").remove();
                }
            })
            */
        },
        dropNode: function(droppedEl, onEl) {
            var self = this;
            var dropped = droppedEl.data().node;
            var on = onEl.data().node;
            console.log(dropped, " was dropped on ", on);
            if (droppedEl.hasClass('leaf')) {
                console.log("node is a leaf");
                if (onEl.hasClass('leaf')) {
                    self.delegate.moveLeaf(self, dropped, on);
                } else {
                    self.delegate.moveLeafToNode(self, dropped, on);
                }
            } else {
                console.log("node is a container node");
                self.delegate.moveNode(self, dropped, on);
            }
        },
        addNewNode: function(dom, to) {
            var self = this;
            dom.addClass("node");
            to.find("ul:first").append(dom);
            self.forceOpen(to, to.data().node);
            // add handlers to new node:
            self.addDragHandler(dom);
            self.addDropHandler(dom);
            self.addOpenHandler(dom, dom.data().node);
            self.delegate.openBranch(self, to, to.data().node);
        },
        removeNode: function(dom) {
            var self = this;
            var from = dom.parents("li:first");
            var node = from.data().node;
            dom.parent()[0].removeChild(dom[0]);
            if ((!node.children || node.children.length === 0)
             && (!node.pages || node.pages.length === 0)) {
                //self.forceClosed(from, node);
                from.find(".icon-expand:first").addClass("icon-collapsed").removeClass("icon-expand").hide();
                self.openState[self.delegate.nodeId(self, node)] = false;
            }
        }
    });

    global.caribou = global.caribou || {};
    global.caribou.editors = global.caribou.editors || {};
    global.caribou.editors.TreeEditor = TreeEditor;
    global.caribou.editors.TreeEditorDelegate = TreeEditorDelegate;
})(window);
