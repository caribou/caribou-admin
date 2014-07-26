(function(global) {
  function models() {
    var validateName = function(name) {
      console.log('Checking name ' + name);
      // if name is invalid, disable form submission
      // tbd.
    };

    // enable sortable elements
    var enableSorting = function( opts ) {
      opts = opts || {};
      var selector = opts.selector || ".sortable";
      var rowNumber = $(".sortable tr").length;

      // Return a helper with preserved width of cells
      if (rowNumber > 1) {
        $(selector).sortable({
          start: function(e, ui){
            ui.placeholder.html('<td colspan="10">&nbsp;</td>');
          },
          placeholder: "ui-sortable-placeholder",
          forcePlaceholderSize: true,
          helper: function(e, ui) {
            ui.children().each(function() {
              $(this).width($(this).width());
            });
            return ui;
          },
          items: "tr:not(.ui-state-disabled)",
          cancel: ".ui-state-disabled",
          update: function(e, ui) {
            updateOrdering(function() {
              console.log("Updated ordering automatically");
            });
            //$('.changeOrderMessage').show();
            // TODO:kd - disable other controls?
          },
          stop: function(e, ui) {
            ui.item.addClass('ui-sortable-highlight');
            setTimeout(function() {
              ui.item.removeClass('ui-sortable-highlight');
            }, 500);
          }
        });
      } else {
        $(selector).sortable({ disabled: true });
        $(selector).removeClass('sortable');
      }
    };

    var _post = function( action, data, success, failure ) {
      success = success || function( data ) {
        location.reload(); // what's the kosher way to do this again?
      };
      failure = failure || function(e) { console.error(e); };

      // submit items
      $.ajax({
        url: global.caribou.api.routeFor( action ),
        type: "POST",
        //dataType: "json",
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify({ data: data }),
        success: success,
        failure: failure
      });
    };

    var positionOrdered = function() {
      var query = location.search.substring(1);
      var settings = query.split(/&/);
      var positioned = true;
      settings.forEach(function(s) {
        var setting = s.split(/=/);
        if(setting[0] == "order" && setting[1] != "position")
          positioned = false;
      });
      return positioned;
    };

    var updateOrdering = function( success ) {
      /* we exit early if ordering is not already by position,
       in order to prevent weird unintended reorderings */
      var positioned = positionOrdered();
      if(!positioned)
        return;
      var selector = $( ".sortable" ).sortable( "option", "items" );
      var parentData = $(".sortable").data("position");
      var items = [];
      var payload = { model: parentData.model,
                      association: parentData.association,
                      id: parentData.umbrella
                    };

      $(".sortable").find(selector).each( function( index, item ) {
        var data = $(item).data("position") || {};
        console.log( "Initial is " + data.position + " and index is " + index );
        if ( data.position !== ( index + parentData.offset + 1 ) ) {
          // we add one because position is one-based, not zero-based.
          items.push({
            id: data.id,
            position: index + parentData.offset + 1
          });
        }
      });
      payload.items = items;
      console.log(payload);
      // submit items
      _post( "reorder-all", payload, success );
    };

    var showDeleteDialog = function( el, callback ) {
      var data = [{
        model: $(el).data().model || "field",
        id: $(el).data().id + ''
      }];
      $('#delete').find('#delete-submit').click( function( e ) {
        e.preventDefault();
        _post( "delete-all", data, function() {
          $('#delete').modal('hide');
          if (callback) {
            callback( data );
          } else {
            location.reload();
          }
        });
        return false;
      });

      $('#delete').modal('show');
      return false;
    };

    var formatAddress = function( data ) {
      // cheesy
      var bits = [];
      var keys = [ "address", "address-two",
                   "city", "state",
                   "postal-code", "country" ];
      _(keys).each(function(key) {
        if (data[key]) {
          bits.push( data[key] );
        }
      });
      return bits.join(",\n");
    };

    var mapImageURL = function( data, width, height ) {
      var url_part = "http://maps.googleapis.com/maps/api/staticmap";
      var query_part = (
        "center={{location}}&zoom=15" +
          "&size={{width}}x{{height}}" +
          "&maptype=roadmap" +
          "&sensor=false"
      );
      var template = url_part + "?" + query_part;
      var builder = _.template( template );
      return builder({
        "location": formatAddress(data),
        "width": (width || 300),
        "height": (height || 300)
      });
    };

    var unrollFieldSlugs = function(modelName, depth, test, visited) {
      visited = visited || {};
      var model = global.caribou.api.model(modelName);
      if (!model) return [];
      if (visited["model-" + model.id]) { return null; }

      visited["model-" + model.id] = true;
      var slugs = [];
      _(model.fields).each(function(f) {
        if (visited["field-" + f.id]) {
          return;
        }
        visited["field-" + f.id] = true;
        if (!test || (test && test(model, f))) {
          if (depth > 0 &&
              (f.type === "link" ||
               f.type === "part" ||
               f.type === "collection")) {
            var targetModel = global.caribou.api.model(f['target-id']);
            if (targetModel && !visited["model-" + targetModel.id]) {
              var associationNames = unrollFieldSlugs(targetModel.slug,
                                                      depth - 1,
                                                      test,
                                                      visited);
              _(associationNames).each(function(a) {
                slugs.push(f.slug + "." + a);
              });
            }
          }
          slugs.push(f.slug);
        }
      });
      visited[model.slug] = true;
      return slugs;
    };

    var dotPathToNestedMap = function(dotPath, val) {
      var bits = dotPath.split(/\./);
      var map = {};
      if (bits.length === 1) {
        map[bits[0]] = val;
      } else {
        map[bits[0]] = dotPathToNestedMap(bits.slice(1).join("."), val);
      }
      return map;
    };

    var nestedMapToDotPathAndValue = function(nestedMap) {
      var keys = _(nestedMap).keys();
      var val = null;
      var dotPath = keys[0];
      var nested = nestedMap[dotPath];
      if (_.isObject(nested)) {
        var deeper = nestedMapToDotPathAndValue(nested);
        return [dotPath + "." + deeper[0], deeper[1]];
      }
      return [dotPath, nested];
    };

    function AddFieldDialog(options) {
      var self = this;
      self.options = options;
      self._selector = options.selector || "#new-field";
      self._element = $(self._selector);
      self._data = options.data;

      self.form = self._element.find("form");
      self.typeSelection = self._element.find("select[name=field-type]");
      self.associationControls = self._element.find("#association-controls");
      self.associationSelection = self.associationControls.find("select");
      self.reciprocalNameField = self.associationControls
        .find("#reciprocal-name");
      self.timestampControls = self._element.find("#timestamp-controls");
      self.enumerationControls  = self._element.find("#enumeration-controls");
      self.searchableCheckbox   = self._element.find("#searchable");
      self.slugControls         = self._element.find("#slug-controls");
      self.slugSelection        = self.slugControls.find("select");
      self.enumerationValues    = self.enumerationControls.find("#values");
      self.submitButton         = self._element.find("input[type=submit]");
      self.attach();
    }

    $.extend(AddFieldDialog.prototype, {
      open: function() {
        this._element.modal();
      },
      close: function() {
      },
      attach: function() {
        var self = this;
        self.typeSelection.off("change").on("change", function(e) {
          e.stopPropagation();
          self.changeTypeSelection();
        });
        self.submitButton.off("click").on("click", function(e) {
          self.submit();
        });
      },
      submit: function() {
        var self = this;
        self.form.submit();
      },
      changeTypeSelection: function() {
        var self = this;
        self.hideControls();
        self.resetControls();
        var v = self.typeSelection.val();
        switch (v) {
        case "collection":
        case "part":
        case "link":
          self.associationControls.show();
          self.associationSelection.prop("disabled", false);
          if (v === "part") {
            self.reciprocalNameField.val(owl.pluralize(self._data.model));
          } else {
            self.reciprocalNameField.val(self._data.model);
          }
          break;
        case "slug":
        case "urlslug":
          self.slugSelection.prop("disabled", false);
          self.slugControls.show();
          break;
        case "password":
          self.searchableCheckbox.prop("checked", false);
          self.searchableCheckbox.prop("disabled", true);
          break;
        case "timestamp":
          self.timestampControls.show();
          break;
        case "enum":
          self.resetEnumerationControls();
          self.enumerationControls.show();
          break;
        default:
          break;
        }
      },
      hideControls: function() {
        var self = this;
        self.slugControls.hide();
        self.associationControls.hide();
        self.enumerationControls.hide();
        self.timestampControls.hide();
      },
      resetControls: function() {
        var self = this;
        self.searchableCheckbox.prop("disabled", false);
        self.associationSelection.prop("disabled", true);
        self.slugSelection.prop("disabled", true);
      },
      newEnumerationValueField: function(value, shouldAdd, shouldRemove) {
        var self = this;
        var newValue = $("<input type='text' name='value' />");
        var addValueButton = $("<a href='#' class='btn btn-primary'>+</a>")
              .on("click", function(e) {
                self.enumerationValues
                  .append(self.newEnumerationValueField("", true, true));
              });
        var removeValueButton = $("<a href='#' class='btn btn-primary'>-</a>")
              .on("click", function(e) {
                $(this).parent("li").remove();
              });
        var newField = $("<li>").append(newValue);
        if (shouldAdd) {
          newField.append(addValueButton);
        }
        if (shouldRemove) {
          newField.append(removeValueButton);
        }
        return newField;
      },
      resetEnumerationControls: function() {
        var self = this;
        self.enumerationValues.empty()
          .append(self.newEnumerationValueField("", true, false));
      }
    });

    var showAddFieldDialog = function( el ) {
      var dialog = new AddFieldDialog({ data: $(el).data() });
      dialog.open();
    };

    var enableDeleteLinks = function( opts ) {
      $(".delete-link").on("click", function(e) {
        e.preventDefault();
        showDeleteDialog( this );
      });
    };

    // enable any sorting on the page initially
    enableSorting();
    enableDeleteLinks();

    return {
      validateName: validateName,
      updateOrdering: updateOrdering,
      showDeleteDialog: showDeleteDialog,
      showAddFieldDialog: showAddFieldDialog,
      enableDeleteLinks: enableDeleteLinks,
      post: _post,
      enableSorting: enableSorting,
      formatAddress: formatAddress,
      mapImageURL: mapImageURL,
      unrollFieldSlugs: unrollFieldSlugs,
      dotPathToNestedMap: dotPathToNestedMap,
      nestedMapToDotPathAndValue: nestedMapToDotPathAndValue
    };
  }

  global.caribou = global.caribou || {};
  global.caribou.models = models();

})( window );
