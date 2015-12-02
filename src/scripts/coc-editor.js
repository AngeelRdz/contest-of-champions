var CoC = CoC || {};
CoC.editor = {};

CoC.editor.initialize = function(){
  CoC.utils.info({
    style: 'initialize',
    value: "Contest of Champions - Guide Editor Tool v"+CoC.version+" -"
  },{
    style: 'link',
    value: "https://github.com/gabriel-hook/contest-of-champions"
  });

  CoC.editor.view = new CoC.view.GuideView({
    model: null,
    el: $("#guide-content")[0]
  });

  location.hash = '';
  var i;
  var championIds = _(CoC.data.champions.pluck('uid')).uniq();
  var editorChampion = $('#editor-champion');
  editorChampion.change(function(e){
    CoC.editor.reset(e.target.value);
  });

  $(document).on('pagebeforeshow', '#page-guide', function(){ 
    $('.select2').select2({
      minimumResultsForSearch: -1,
      tags: true,
      tokenSeparators: [',', ' ']
    });
    CoC.editor.reset();
  });

  //make sure we have enough padding below to scroll all the way down
  var deltaScrollY = 0;
  var lastScrollY = 99999999999999;
  everyFrame(function onDraw(){
    var popup = $('#popup-editor-popup');
    var popupHeight = popup.height() || 0;
    var guideContent = $('#guide-content');
    var contentBottomMargin = 0;
    if(popup.length){
      var headerHeight = $('#header').height();
      var viewportHeight = window.innerHeight - headerHeight;
      var scrollY = window.scrollY;
      var marginBottom = 0;
      deltaScrollY += scrollY - lastScrollY;
      lastScrollY = scrollY;
      if(viewportHeight < popupHeight){
        marginBottom = deltaScrollY = Math.min(0, Math.max(viewportHeight - popupHeight, deltaScrollY));
      }
      popup.css('margin-bottom', marginBottom);
      contentBottomMargin = Math.max(0, popupHeight - guideContent.height() - headerHeight);
    }
    guideContent.css('margin-bottom', contentBottomMargin);
  });

  //reset to bottom when we close
  $('#popup-editor').on('popupafterclose', function(){
    lastScrollY = 99999999999999;
  });
  $('#popup-editor').on('popupafteropen', function(){
    $('.ui-panel-open').panel('close');
  });
  
  function everyFrame(callback){
    var raf = window.requestAnimationFrame || 
      window.webkitRequestAnimationFrame || 
      window.mozRequestAnimationFrame || 
      window.msRequestAnimationFrame || 
      window.oRequestAnimationFrame || 
      function(callback){ 
        window.setTimeout(callback, 1000/60);
      };
    raf(function action(){
      callback();
      raf(action);
    });
  }
};

CoC.editor.reset = function(champion){
  var hasChampion = champion && champion !== '';
  var guideData = hasChampion && CoC.data.guides.get(champion).data;
  var initSelect = initInput.bind(null, 'selectmenu', 'change');
  var initMultiSelect = initInput.bind(null, 'multiselect', 'change');
  var initRadio = initInput.bind(null, 'checkboxradio', 'change');
  var initText = initInput.bind(null, 'textinput', 'blur keydown keyup');

  initSelect('#editor-grade', ['grades', 'normal']);
  initSelect('#editor-grade-awakened', ['grades', 'awakened']);
  initText('#editor-description', ['description']);

  initRadio('[name=editor-gameplay-rating]', ['gameplay', 'rating']);
  initText('#editor-gameplay-style', ['gameplay', 'style']);
  initText('#editor-gameplay-description', ['gameplay', 'description']);
  initText('#editor-gameplay-strategy', ['gameplay', 'strategy']);
  initMultiSelect('#editor-gameplay-abilities', ['gameplay', 'abilities']);
  initText('#editor-gameplay-note', ['gameplay', 'note']);

  initRadio('[name=editor-attack-rating]', ['attack', 'rating']);
  initText('#editor-attack-description', ['attack', 'description']);
  initText('#editor-attack-heavy', ['attack', 'heavy']);
  initMultiSelect('#editor-attack-abilities', ['attack', 'abilities']);
  initText('#editor-attack-note', ['attack', 'note']);

  initRadio('[name=editor-signature-rating]', ['signature', 'rating']);
  initText('#editor-signature-name', ['signature', 'name']);
  initText('#editor-signature-description', ['signature', 'description']);
  initText('#editor-signature-note', ['signature', 'note']);

  initRadio('[name=editor-special-1-rating]', ['specials', '1', 'rating']);
  initText('#editor-special-1-name', ['specials', '1', 'name']);
  initText('#editor-special-1-description', ['specials', '1', 'description']);
  initMultiSelect('#editor-special-1-abilities', ['specials', '1', 'abilities']);
  initMultiSelect('#editor-special-1-damagetypes', ['specials', '1', 'damagetypes']);
  initMultiSelect('#editor-special-1-ranges', ['specials', '1', 'ranges']);
  initText('#editor-special-1-note', ['specials', '1', 'note']);

  initRadio('[name=editor-special-2-rating]', ['specials', '2', 'rating']);
  initText('#editor-special-2-name', ['specials', '2', 'name']);
  initText('#editor-special-2-description', ['specials', '2', 'description']);
  initMultiSelect('#editor-special-2-abilities', ['specials', '2', 'abilities']);
  initMultiSelect('#editor-special-2-damagetypes', ['specials', '2', 'damagetypes']);
  initMultiSelect('#editor-special-2-ranges', ['specials', '2', 'ranges']);
  initText('#editor-special-2-note', ['specials', '2', 'note']);

  initRadio('[name=editor-special-3-rating]', ['specials', '3', 'rating']);
  initText('#editor-special-3-name', ['specials', '3', 'name']);
  initText('#editor-special-3-description', ['specials', '3', 'description']);
  initMultiSelect('#editor-special-3-abilities', ['specials', '3', 'abilities']);
  initMultiSelect('#editor-special-3-damagetypes', ['specials', '3', 'damagetypes']);
  initText('#editor-special-3-note', ['specials', '3', 'note']);

  initText('#editor-author-name', ['author', 'name']);
  initSelect('#editor-author-profile-type', ['author', 'profile', 'type']);
  initText('#editor-author-profile-name', ['author', 'profile', 'name']);

  if(hasChampion){

    //Exporting
    $('#editor-export').click(function(){
      var guide = CoC.data.guides.get(champion);
      var guideJson = JSON.stringify(guide.data, null, '\t');
      var guideJsonName = champion + ".json";
      CoC.utils.log({ style: 'io', value: "Exporting guide..." },{ style: 'filename', value: guideJsonName });
      if (isInternetExplorer()){
        rosterExportFrame.document.open("application/json", "replace");
        rosterExportFrame.document.close();
        rosterExportFrame.focus();
        rosterExportFrame.document.execCommand('SaveAs', true, guideJsonName);
      }
      else{
        $('#editor-export')
          .attr('download', guideJsonName)
          .attr('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(guideJson));
      }
    }); 
    if(isMobileIOS()){
      $('#editor-export').addClass("ui-disabled");
    }
    //json importer
    else if(window.FileReader){
      $('#editor-export').removeClass("ui-disabled");
    }
    //windows safari and other bullshit browsers that dont support FileReader
    else{
      $('#editor-export').removeClass("ui-disabled");
    } 
    CoC.editor.view.render(champion, true);


    $('.editor-tabs').removeClass("ui-disabled");
  }
  else{
    CoC.editor.view.$el.empty();

    $('.editor-tabs').addClass("ui-disabled");
    $('#editor-export').addClass("ui-disabled");
  }

  //Importing
  if(isMobileIOS()){
    $('#editor-import').addClass("ui-disabled");
  }
  //json importer
  else if(window.FileReader){
    $('#editor-import-input').unbind('change').change(function(e){
      if (this.files && this.files[0]) {
        var reader = new FileReader();
        var file = this.files[0];
        var name = championFromFilename(file.name) || champion;
        CoC.utils.log({ style: 'io', value: "Importing guide..." },{ style: 'filename', value: file.name });
        reader.onload = function (e) {
          var json;
          try{
            json = JSON.parse(e.target.result);
          } 
          catch(e){
            console.error(e);
          }
          if(json) try{
            if(name === ''){
              console.error('Cannot find a champion for file "'+file.name+'"');
              return;
            }

            CoC.data.guides.raw[name] = json;
            CoC.data.guides.init(name);
            CoC.editor.reset(name);

            if(champion !== name){
              $('#editor-champion option[value='+name+']').attr('selected', 'selected');
              $('#editor-champion').selectmenu('refresh');
            }
          } 
          catch(e){
            console.error(e);
          }
        };
        reader.readAsText(file);
        $(this).val("");
      }
    });
    $('#editor-import').unbind('click').click(function(){
      $('#editor-import-input').click();
    });

    $('#editor-import').removeClass("ui-disabled");
  }
  //windows safari and other bullshit browsers that dont support FileReader
  else{
    $('#editor-import').addClass("ui-disabled");
  } 

  function championFromFilename(filename){
    var uid = filename.split(/\.|\(|[ ]/)[0];
    return (CoC.data.champions.where({ uid:uid }).length > 0)? uid: null;
  }

  function hasKeys(object){
    for(var k in object)
      return true;
    return false;
  }

  function updateChampion(callback){
    if(!hasChampion)
      return;

    var lastScroll = window.scrollY;

    var guide = CoC.data.guides.get(champion);
    delete guide.data.unavailable;
    callback.call(null, guide.data);
    CoC.data.guides.set(champion, guide);
    CoC.editor.view.render(champion, true);
    setTimeout(function(){
      $.mobile.silentScroll( lastScroll );
    });
  }

  function initInput(type, binds, query, namespace){
    var i, initialValue;
    var el = $(query);
    var value = '';
    var object = guideData;
    for(i=0; i<namespace.length; i++)
      if(object)
        object = object[namespace[i]];
    if(object)
      value = object;
    if(type === 'multiselect'){
      el.val(value);
      el.select2('destroy').select2();
    }
    else if(type === 'checkboxradio'){
      if(value)
        $(query+'[value='+value+']').attr('checked', true);
      else
        $(query).attr('checked', false);
      el[type]('refresh');
    }
    else{
      el.val(value);
      el[type]('refresh');
    }
    initialValue = value;
    el.unbind(binds);
    el.bind(binds, function(e){
      updateChampion(function(guideData){
        var i;
        var data;
        var value;
        var object;
        var ordered;
        if(type === 'multiselect'){
          value = el.val();
          el.select2('destroy').select2();
        }
        else{
          value = e.target.value;
          el[type]('refresh');
        }
        if(!value){
          object = guideData;
          ordered = [];
          for(i=0; object[namespace[i]] && i < namespace.length; i++){
            ordered.push(object);
            if(i < namespace.length - 1)
              object = object[namespace[i]];
          }
          if(i === namespace.length){
            i--;
            delete object[namespace[i]];
            for(;i > 0; i--)
              if(!hasKeys(ordered[i])){
                delete ordered[i-1][namespace[i-1]];
              }
              else
                break;
          }
        }
        else{
          object = guideData;
          for(i=0; i < namespace.length - 1; i++)
            if(i < namespace.length - 1){
              object[namespace[i]] = object[namespace[i]] || {};
              object = object[namespace[i]];
            }
          object[namespace[i]] = value; 
        }
      });
    });
  }

  function isMobileIOS(){
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  function isInternetExplorer() {
    return (window.navigator.userAgent.indexOf("MSIE ") !== -1 || 
      !!navigator.userAgent.match(/Trident.*rv\:11\./))? true: false;
  }
};
