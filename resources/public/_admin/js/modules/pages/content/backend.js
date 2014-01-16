// --------------------------------------------------------
// backend.js
// Some core backend functionality such as managing the
// access and retrieval of model information from the
// server.  Most of these functions can be considered
// utility functions and accessed via window.caribou.api.
// --------------------------------------------------------

(function (global) {
    function CaribouAPI( api ) {
      var self = {
        _model: {},
        routeFor: function( action, params ) {
            params = params || {};
            params['action'] = action;
            // TODO:kd - filter for nulls
            if ( !params['id'] ) {
              delete params['id'];
            }
            return api + "?" + $.param( params );
        },
        initWithModel: function( model ) {
          self._model = self._model || {};
          self._modelSlugs = self._modelSlugs || [];
          _( model ).each( function(m) {
            if (!self._model[ m.slug ]) {
              self._modelSlugs.push(m.slug);
            }
            self._model[ m.slug ] = m;
            self._model[ m.id ] = m;
          });
        },
        model: function( slug ) {
          console.log("=============================== request for " + slug + " ==============================");
          if (self._model[ slug ]) { return self._model[ slug ] }
          var options = { model: "model", include:"fields" };
          if ( _.isNumber( slug ) || (slug + "").match(/^\d+$/) ) {
            options.id = slug;
          } else {
            options.slug = slug;
          }
          // calling this synchronously is bad.
          $.ajax({
            type: "POST",
            async: false,
            url: self.routeFor( "find-one", options ),
            success: function( data ) {
              self.initWithModel( [data] );
            }
          });
          return self._model[ slug ];
        },
        invokeModels: function() {
          self._allModelsLoaded = true;
          $.ajax({
            type: "GET",
            async: false,
            url: self.routeFor("find-all", { model: "model", include: "fields" }),
            success: function( data ) {
              self.initWithModel(data);
            }
          });
        },
        allModelSlugs: function() {
          if (!self._allModelsLoaded) {
            self.invokeModels();
          }
          return self._modelSlugs;
        },
        bestTitle: function( m, slug ) {
          var model = self.model( slug );
          if ( !model ) { console.error( "No such model " + slug ); return }
          var guess = "";
          _( model.fields ).each( function(f) {
            guess = guess || m[f.slug];
          });
          return guess;
        },
        // if you have a better way to do this, please
        // let me know...
        deepClone: function( obj ) {
          return JSON.parse( JSON.stringify( obj ) );
        },
        difference: function(template, override) {
          var ret = {};
          for (var name in template) {
            if (name in override) {
              if (_.isObject(override[name]) && !_.isArray(override[name])) {
                var diff = self.difference(template[name], override[name]);
                if (!_.isEmpty(diff)) {
                  ret[name] = diff;
                }
              } else if (!_.isEqual(template[name], override[name])) {
                ret[name] = override[name];
              }
            }
          }
          return ret;
        },
        post: function( data, success, failure ) {
          success = success || function( data ) {
            location.reload(); // what's the kosher way to do this again?
          };
          failure = failure || function(e) { console.error(e) };

          // submit items
          $.ajax({
            url: self.routeFor( "update-all" ),
            type: "POST",
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify({ data: data }),
            success: success,
            failure: failure
          });
        },
        cookieValue: function( key ) {
          return $.cookie(key);
        },
        setCookieValue: function( key, value ) {
          $.cookie( key, value );
        }
      };

      return self;
    }

    global.caribou = global.caribou || {};
    global.caribou.api = CaribouAPI( $('body').data().api );
})(window);
