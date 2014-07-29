function loadScript(url)
{    
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;    

    //script.onreadystatechange = callback;
    //script.onload = callback;

    head.appendChild(script);
};

function loadScripts(urls)
{
    for(var i = 0; i < urls.length; i++)
    {
        loadScript(urls[i], function(){});
    }
};

var urls = ["../graphrenderer/datacaching/dataStream.js",
            "../graphrenderer/datacaching/webSockets.js",
            "../graphrenderer/helpers/dataHandler.js",
            "../graphrenderer/helpers/historyHandler.js",
            "../graphrenderer/helpers/dateTimeFormat.js",
            "../graphrenderer/datacaching/dataCacher.js", 
            "../graphrenderer/aggregators/meanPercents.js",
            "../graphrenderer/aggregators/standartDeviation.js",
            "../graphrenderer/rendering/masterChartRenderer.js",
            "../graphrenderer/rendering/detailChartRenderer.js"];
loadScripts(urls);