$(function() {
  $("#command-menu").off("change").on("change", function(e) {
    var command = $(this).val();
    switch (command) {
      case "edit":
        var pageInfo = $("body").data();
        var ids = [];
        $("input[type=checkbox][name=id]:checked").each(function(index, el) {
            ids.push( $(el).val() );
        });
        window.location.href = window.caribou.api.routeFor("to-route", {
            page: "admin.edit-model-instance",
            id: ids.join(":"),
            slug: pageInfo.model
        });
        break;
      default:
    };
  }).show();

  $("table.caribou-results").trigger("didRender");
});
