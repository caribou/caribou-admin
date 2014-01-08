// attach useful functions to a global namespace
(function(global) {
    var openModalWithClass = function(openModalClass, options) {
        options = options || {};
        $(".overlay").show();
        $(".modal").removeClass().addClass("modal");
        $("." + openModalClass + ".modal-content").parent(".modal").show().addClass(openModalClass);

        if ( $(window).innerHeight() <= 750 ) {
            $('.modal').addClass('absolute');
        } else {
            $('.modal').removeClass('absolute');
        }
        $(window).resize(function(){
            if ( $(window).innerHeight() <= 750 ) {
                $('.modal').addClass('absolute');
                } else {
                $('.modal').removeClass('absolute');
            }
            if ( $('.modal').hasClass('absolute') ) {
                $(window).scrollTop(0);
            }
        })

        if (!options.allowClose) {
            $("." + openModalClass).find(".caribou-icon-close").hide();
        }
        if ( $('.modal').hasClass('absolute') ) {
            $(window).scrollTop(0);
        }
        return $("." + openModalClass + ".modal-content").show();
    };

    var openModal = function() {
       var openModalClass = $(this).data('modalopen');
       openModalWithClass(openModalClass);
       $("." + openModalClass).find(".caribou-icon-close").show();
    };
    var closeModal = function( callback ) {
        $(".overlay").hide();
        $(".modal").hide();
        $(".modal").removeClass().addClass("modal");
        $(".modal-content").hide();
        if (callback) {
            callback(this);
        }
    };

    global.caribou = global.caribou || {};
    global.caribou.modal = {
        open: openModal,
        close: closeModal,
        openWithClass: openModalWithClass
    };

    var wrapCallback = function(callback) {
        return function(data, error, jqxhr) {
            if (data && data.error && error === "success") {
                callback(data, data.error, jqxhr);
            } else {
                if (typeof data === "string") {
                    window.location.href = "/login?redirect=" + window.location.href;
                } else {
                    callback(data, error, jqxhr);
                }
            }
        };
    };
    var errorHandler = function(jqxhr, message, errorThrown) {
        var msg = errorThrown + ": " + message;
        window.location.href = "/login?" + $.param({ message: msg, redirect: window.location.href });
    };

    // set a long timeout for ajax requests
    $.ajaxSetup({
        timeout: 10 * 60 * 1000 // ten minutes
    });

    global.caribou.admin = {
        get: function(url, callback) {
            $.ajax({ url: url, type: "GET", success: wrapCallback(callback), error: errorHandler });
        },
        post: function(url, data, callback, options) {
            options = options || {};
            $.ajax(_.extend({
                url: url,
                data: data,
                type: "POST",
                success: wrapCallback(callback),
                error: errorHandler
            }, options));
        },
        put: function(url, data, callback, options) {
            options = options || {};
            $.ajax(_.extend({
                url: url,
                data: data,
                type: "PUT",
                success: wrapCallback(callback),
                error: errorHandler
            }, options));
        },
        "delete": function(url, callback) {
            $.ajax({
                url: url,
                type: "DELETE",
                success: wrapCallback(callback),
                error: errorHandler
            });
        },
        ping: function(callback, errorCallback) {
            $.ajax({
                url: "/session-ping",
                type: "GET",
                success: function(data, error, jqxhr) {
                    if (data && data.result === "OK") {
                        return callback();
                    }
                    return errorCallback();
                },
                error: errorCallback
            });
        }
    };
})(window);

$(document).ready(function() {
    $('.open-modal').on("click", window.caribou.modal.open);

    $(".modal .caribou-icon-close").on("click", function(e) {
        window.caribou.modal.close();
    });

    $(".modal .delete-yes").on("click", function(e) {
        window.caribou.modal.close();
        $(".message").show();
        $("tr.delete-row").remove();
    });

    $(".modal .cancel").on("click", function(e) {
        window.caribou.modal.close();
        $("tr.delete-row").removeClass();
    });

});

