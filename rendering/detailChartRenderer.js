var detailChartRenderer = function(containerId)
{
    "use strict";

    var me = {};
    me.className = 'detailChartRenderer';
    me.hostURL = '././.';

    me.masterChart    = new masterChartRenderer();
    me.historyHandler = new historyHandler();    
    me.db             = new dataCacher('httpgetbinary', true, true, false, false);

    me.containerId = containerId;
    me.masterChartId = 'masterChart';
    me.id = 'detailChart';
    me.masterChartSeriesNumber = 0;    
    me.chart = null;
    me.rect = null;

    me.aggregators = null;

    me.upControl = null;
    me.downControl = null;
    me.leftControl = null;
    me.rightControl = null;
    me.moovingRightCount = 0;
    me.moovingLeftCount = 0;
    me.isHistoryMoving = false;

    me.intervalVariable = null;    
    me.callbacksOnRefreshing = [];  
    me.filters = [];

    me.axes = null;
    me.axesToShow = [];  
    me.axesToChannels = [];  
    me.neddenAxes = [];    
     
    me.selectedXExtremes = null;
    me.selectedYExtremes = []; 
    me.resetXAxisAfterRenderTime = false;
    me.resetYAxisAfterRenderTime = false;
    me.setUpNeedenExtremes = false;   
      
    me.stopPropagation = false;

    me.series = null;
    me.divWidth = null;
    me.divHieght = null;
    me.pointCount = 800;
    me.timer = null;
    me.delta = 0;
    me.resolutionMultiplier = 0.4;
    me.zoomMultiplier = 50;    
    me.mouseDown = 0;
    me.initialBeginTime = null;
    me.initialEndTime = null;    
    me.dragData = null;
    me.zoomType = 'xy';
    me.chartOptions = null;
    me.isLegendEnabled = false;
    me.firstRequest = false;
    me.needenWindow = '-';
    
    me.previousStateX = null;
    me.previousStateY = null;
    
    me.dataSources = [];
    me.currentDataSource = 0;
    me.allChannels = null;
    me.dataSourcePeriod = 0;
    me.dataSourceLevel = null;
    me.dataSourcesToChannels = []; 

    me.temporaryAxis = 
    {
        gridLineWidth: 0, 
        id: 'temporary',
        labels: 
        {
            format: '{value}', 
            style: 
            { 
                color: 'black'
            }
        }, 
        title: 
        {
            text: 'Temporary axis', 
            style: 
            { 
                color: 'black'
            }
        }
    };

    me.Request = function(cfg)
    {
        var self = this;  
        var dataSource = {};
        dataSource.db_server = cfg.db_server;
        dataSource.db_name = cfg.db_name;
        dataSource.db_group = cfg.db_group;
        dataSource.aggregation = cfg.aggregation;   
        dataSource.channels = cfg.db_mask;    
        var experiment = cfg.experiment;
        self.axes = [];
        if(dataSource.aggregation === null)
        {
            dataSource.aggregation = 'mean';
        }       
        if(parseInt(cfg.window, 10) !== 0)
        {
            self.needenWindow = (cfg.window);  
        }    
        self.pointCount = self.divWidth * self.resolutionMultiplier;
        self.masterChart.setOnZoomCallback(self.onZoomMasterChartEvent.bind(self));         
        if(self.chart !== null && self.masterChart !== null && self.masterChart.chart !== null)
        {
            self.resizeCharts();
            self.divWidth = self.getDivWidth(self.id);
            self.divHieght = self.getDivHieght(self.id);            
            self.masterChart.recalculateDivSizes();
        } 
        if(dataSource.db_server === 'virtual' && dataSource.db_name === 'srctree')
        {            
            var srctree = cfg.srctree.split(',');
            var virtualSources = self.formVirtualSources(srctree);            
            if(self.isPriviousRequest(virtualSources))
            {
                return;
            }
            else{self.dataSources = [];self.axesToShow = []; self.firstRequest = true; }          
            var min = 9999999999999999;
            var max = 0;                
            for (var i = 0; i < virtualSources.length; i++) 
            { 
                if(virtualSources[i].channels.split(',').length > 10)
                {
                    alert('You setted up more then 10 channels.');
                    return;
                }
                self.axes.concat(getAllAxes(virtualSources[i]));
                self.formAxesInfo(virtualSources[i]);
                if(experiment === '-' || experiment === '*-*')
                { 
                    var time = self.getExperimentInterval(virtualSources[i]);                           
                    var beginTime = time.split('-')[0];
                    var endTime = time.split('-')[1];
                    if(parseInt(min, 10) > parseInt(endTime, 10))
                    {
                        min = endTime;
                    }
                    if(parseInt(max, 10) < parseInt(beginTime, 10))
                    {
                        max = beginTime;
                    }  
                }
                else
                {
                    min = experiment.split('-')[1];
                    max = experiment.split('-')[0];
                }
            }
            self.initialBeginTime = max;
            self.initialEndTime = min;
            self.dataSources = virtualSources;
            if(!self.stopPropagation)
            {
                self.refreshChartFromMasterChart(max, min);
                self.bindEvents();
                self.masterChart.bindEvents();
            }            
        }
        else
        {   
            if(self.isPriviousRequest([dataSource]))
            {
                return;
            }
            else{self.dataSources = []; self.firstRequest = true;self.axesToShow = [];}           
            if(experiment === '-' || experiment === '*-*')
            {
                experiment = self.getExperimentInterval(dataSource);
            }  
            if(dataSource.channels.split(',').length > 10)
            {
                alert('You setted up more then 10 channels.');
                return;
            }
            self.initialBeginTime = experiment.split('-')[0];
            self.initialEndTime = experiment.split('-')[1];
            self.addStateInHistory(self.initialBeginTime, self.initialEndTime);
            self.axes = self.getAllAxes(dataSource); 
            self.formAxesInfo(dataSource);
            self.dataSources.push(dataSource);
            self.renderChart(experiment);  
        }   
    };

    me.renderChart = function(experiment)
    {
        var self = this;       
        self.divWidth = self.getDivWidth(self.id);
        self.divHieght = self.getDivHieght(self.id);        
        self.onDraggingRigth = self.divWidth - self.onDraggingLeft;        

        self.series = [];
        self.dataSourcesToChannels = [];
        self.formChart(self.id, self.series);
        self.pointCount = self.chart.chartWidth * self.resolutionMultiplier;
        self.chart = jQuery('#' + self.id).highcharts();
        self.masterChart.setOnZoomCallback(self.onZoomMasterChartEvent.bind(self));
        try
        {
            
                self.db.getData(self.dataSources[0].db_server, self.dataSources[0].db_name, self.dataSources[0].db_group,
                        self.dataSources[0].channels, experiment,
                        self.pointCount, self.dataSources[0].aggregation, function(obj)
                {
                    self.dataSourceLevel = self.db.level.window;
                    if (obj === null)
                    {             
                        console.log('No data in server responces');
                    }
                    else
                    {
                        for (var i = 0; i < obj.data.length; i++)
                        {
                            var series = self.parseData(obj, i);
                            series.dataSource = self.dataSources[self.currentDataSource].db_server + ' ' + self.dataSources[self.currentDataSource].db_name + ' ' + self.dataSources[self.currentDataSource].db_group;                        
                            self.addSeries(series, true);  
                            self.dataSourcesToChannels.push(self.dataSources[0].db_server  + ' '
                            + self.dataSources[0].db_name  + ' ' 
                            + self.dataSources[0].db_group);
                        }
                        var masterSeries = {};
                        masterSeries.data = self.series[0].data;
                        masterSeries.name = self.series[0].name;
                        self.masterChart.renderMasterChar(self.masterChartId, masterSeries, self.masterChartSeriesNumber);
                        self.masterChart.changePlotbands(experiment.split('-')[0] * 1000, experiment.split('-')[1] * 1000);
                        if(self.firstRequest === true)
                        {
                             
                            var max = self.chart.xAxis[0].max;
                            var min = self.chart.xAxis[0].min;
                            if(typeof self.needenWindow.split('-')[1] !== 'undefined')
                            {
                                var minWindow = parseInt(self.needenWindow.split('-')[0], 10) * 1000;
                                var maxWindow = parseInt(self.needenWindow.split('-')[1], 10) * 1000;
                                if(minWindow >= min && maxWindow <= max && minWindow < maxWindow)
                                { 
                                    min = minWindow;
                                    max = maxWindow;
                                }
                            }
                            else
                            {
                                var diffrence = max - min;                    
                                if(diffrence > (parseInt(self.needenWindow, 10) * 1000))
                                {
                                    min = max - parseInt(self.needenWindow, 10) * 1000;
                                }
                            }                
                            self.chart.xAxis[0].setExtremes(min, max);
                            self.masterChart.changePlotbands(min, max);
                            self.firstRequest = false;                            
                        }
                    }
                    self.rebuildAxesControls();
                    self.setChartTitle();
                    self.setUpMetadataInMasterChart();

                });
            
        }
        catch (ex)
        {
            console.log(ex);
        }

    };

    jQuery(window).resize(function() 
    {   
        chart.resizeCharts();        
        chart.masterChart.recalculateDivSizes();        
        chart.divWidth = chart.getDivWidth(chart.id);
        chart.divHieght = chart.getDivHieght(chart.id);
    });

    me.formChart = function(id, series, yAxises)
    {
        var self = this;
        var title = self.formTitle();
        for(var i = 0; i < series.length; i++)
        {
    	    series[i].lineWidth = 1;
        }
        self.chartOptions = {
            chart:
                    {                        
                        zoomType: '',
                        height: 800,
                        events:
                                {
                                    selection: self.onZoomEvent.bind(self)
                                },
                        interpolate: 
                                {
                                    enabled: true                                                                                   
                                },
                        plotShadow: true,
                        animation: false,
                        marginRight: 40,
                        resetZoomButton: 
                        {
                            theme:
                            {
                                display: 'none'
                            }
                        }


                    },
            credits:
                    {
                        enabled: false
                    },
            title:
                    {
                        text: ' ',
                        margin: 10
                    },
            yAxis: self.axesToShow,
            xAxis:
                    {
                        type: 'datetime',
                        gridLineWidth: 0.5
                    },
            legend:
                    {
                        enabled: self.isLegendEnabled,               
                        itemHiddenStyle:
                                {
                                    color: '#000000',
                                    fontWeight: 'normal'
                                },
                        itemStyle:
                                {
                                    color: '#000000',
                                    fontWeight: 'bold'
                                },
                        align: 'right',
                        verticalAlign: 'top',
                        layout: 'vertical',
                        y: 20,
                        x: -100,
                        symbolHeight: 20,
                        floating: false                        
                    },
            plotOptions:
                    {
                        line:
                                {
                                    dataLabels:
                                            {
                                                enabled: false
                                            }
                                },
                        series:
                                {
                                    stacking: null,
                                    allowPointSelect: true,
                                    connectNulls: false,
                                    cursor: 'pointer',
                                    point:
                                            {
                                                events:
                                                        {
                                                            click: self.showLabels
                                                        }
                                            },
                                    marker:
                                            {
                                                enabled: false,
                                                states:
                                                        {
                                                            hover:
                                                                    {
                                                                        enabled: true
                                                                    }


                                                        }
                                            },
                                    shadow: false,
                                    states:
                                            {
                                                hover:
                                                        {
                                                    	    enabled: true,
                                                    	    lineWidth: 1                                                            
                                                        }
                                            },
                                    threshold: null
                                }
                    },
            tooltip:
                    {
                        useHTML: true,
                        enabled: false,
                        shared: true,
                        crosshairs: [{
                                width: 0.5,
                                color: 'red',
                                dashStyle: 'longdash'
                            }],
                        pointFormat: '<span style="color:{series.color}">{series.name}</span>: <b>{point.y}</b><br/>',
                        valueDecimals: 8,
                        hideDelay: 0,
                        animation: false,
                        xDateformat: '%Y-%m-%d<br/>%H:%M',
                        positioner: self.tooltipPosition.bind(self)
                    },
            series: series,
            exporting: 
            {
                buttons: 
                {                    
                    menu: {
                        x: -40,
                        symbol: 'circle',                        
                        menuItems: self.menuItems,   
                        _titleKey: 'Menu',
                        theme: 
                        {
                            zIndex: 20
                        }                                         
                    },                   
                    zoomInButton: {
                        x: -50,
                        y: 140,
                        _titleKey: 'Zoom in',
                        onclick: self.zoomIn.bind(self),
                        text: '+',  
                        theme: 
                        {
                            zIndex: 20
                        }                           
                    },
                    zoomOutButton: {
                        x: -35,
                        y: 140,
                        _titleKey: 'Zoom out',
                        onclick: self.zoomOut.bind(self),
                        text: '-',   
                        theme: 
                        {
                            zIndex: 20
                        }
                    }
                    /*prevStateButton: {
                        x: -55,
                        y: 80,
                        _titleKey: 'To previous state',
                        onclick: self.renderPreviousState.bind(self),
                        text: '<-',   
                        theme: 
                        {
                            zIndex: 20
                        } 
                    },
                    nextStateButton: {
                        x: -25,
                        y: 80,
                        _titleKey: 'To next state',
                        onclick: self.renderNextState.bind(self),
                        text: '->',   
                        theme: 
                        {
                            zIndex: 20
                        } 
                    }*/
                    
                }
            }
        };
        jQuery('#' + id).highcharts(self.chartOptions);
        self.chart = jQuery('#' + self.id).highcharts();
        var sourceWidth;
        if(document.getElementById('main_sidebar_source').offsetWidth > document.getElementById('main_sidebar_controls').offsetWidth)
        {
            sourceWidth = document.getElementById('main_sidebar_source').offsetWidth;
        }
        else
        {
            sourceWidth = document.getElementById('main_sidebar_controls').offsetWidth;
        }
        self.chart.setSize
        (
            jQuery(window).width() - sourceWidth, 
            jQuery(window).height() - document.getElementById('header_div').offsetHeight - 100  - 70,
            false
        ); 
        self.divWidth = self.getDivWidth(self.id);
        self.divHieght = self.getDivHieght(self.id);
        self.buildControls();
        self.bindEvents();
        self.masterChart.bindEvents();
    };

    me.onZoomEvent = function()
    {
        var self = this;  
        var begTime = self.selectedXExtremes.beginTime;
        var endTime = self.selectedXExtremes.endTime;
        self.removeSelection();
        self.setUpNeedenExtremes = true;       
        self.masterChart.changePlotbands(begTime, endTime);
        if(!self.stopPropagation)
        {
            self.refreshChart(begTime / 1000, endTime / 1000);
        }  

    };

    me.onZoomMasterChartEvent = function(event)
    {
        var self = this;
        var begTime = event.xAxis[0].min / 1000;
        var endTime = event.xAxis[0].max / 1000;
        begTime = (begTime.toString()).split('.')[0];
        endTime = (endTime.toString()).split('.')[0];
        if(!self.stopPropagation)
        {
            self.refreshChartFromMasterChart(begTime, endTime); 
        }        
    };


    me.refreshZoomSeries = function(beginTime, endTime)
    {
        var self = this;
        var beginTime1 = beginTime - (endTime - beginTime);
        var endTime1 = endTime + (endTime - beginTime);
        beginTime1 = beginTime1 > self.initialBeginTime ? beginTime1 : self.initialBeginTime;
        endTime1 = endTime1 < self.initialEndTime ? endTime1 : self.initialEndTime;
        try
        {

            self.db.getData(self.dataSources[self.currentDataSource].db_server, self.dataSources[self.currentDataSource].db_name, self.dataSources[self.currentDataSource].db_group,
                    self.dataSources[self.currentDataSource].channels, beginTime1 + '-' + endTime1,
                    self.pointCount, self.dataSources[self.currentDataSource].aggregation, function(obj)
            {
                self.dataSourceLevel = self.db.level.window;
                if (obj === null)
                {
                    self.currentDataSource++;
                    self.series.push([]);
                    self.refreshChart(beginTime, endTime);
                    console.log('No data in server responces.');                
                    return;                   
                }
                else
                {                   
                    for (var i = 0; i < obj.data.length; i++)
                    {
                        var series = self.parseData(obj, i); 
                        self.series.push(series);  
                    }
                    self.currentDataSource++;
                    self.refreshChart(beginTime, endTime);

                }
            });

        }
        catch (ex)
        {
            self.currentDataSource++;
            self.refreshChart(beginTime, endTime);
            console.log(ex);
        }
    };

    me.refreshChart = function(beginTime, endTime)
    {
        var self = this;        
        if (self.currentDataSource === 0)
        {              
            self.db.dataHandl.deleteWorkers();
            self.stopPropagation = true;   
            self.series = [];       
            self.refreshZoomSeries(beginTime, endTime);
        }        
        else if (self.currentDataSource < self.dataSources.length)
        {
            self.refreshZoomSeries(beginTime, endTime);
        }
        else
        {                     
            self.setUpNewSeries();            
            self.chart.xAxis[0].setExtremes(beginTime * 1000, endTime * 1000, false);            
            self.rebuildAxesControls();                       
            self.setChartTitle();
            self.removeSelection();
            self.addStateInHistory(beginTime, endTime);  
            if(self.setUpNeedenExtremes)   
            {
                self.setSelectedExtremes();
                self.setUpNeedenExtremes = false;
            }
            self.chart.redraw();
            self.callCallbacks(beginTime, endTime);
            self.stopPropagation = false; 
            self.isHistoryMoving = false;
            self.currentDataSource = 0;
        }         
    };

    me.setChartTitle = function()
    {
        var self = this;
        var title = self.formTitle();
        if(self.masterChart !== null)
        {
            self.masterChart.setTitle(title); 
        }        
    };

    me.callCallbacks = function(beginTime, endTime) // :DDD
    {
        var self = this;
        for(var i = 0; i < self.callbacksOnRefreshing.length; i++)
        {
            self.callbacksOnRefreshing[i](beginTime, endTime);
        }
    };

    me.setUpNewSeries = function()
    {
        var self = this;
        for (var i = 0; i < self.series.length; i++)            
        {
            for(var j = 0; j < self.chart.series.length; j++)
            {
                if(typeof self.chart.series[j] !== 'undefined' && self.chart.series[j].name === self.series[i].name)
                {   
                    self.chart.series[j].setData(self.series[i].data, false, false);
                    break;                                     
                }    
                else if(self.series.length > self.chart.series.length)
                {
                    /*self.series[i].lineWidth = 1;
                    self.chart.addSeries(self.series[i], false);  
                    break;*/

                }            
            }            
        }

    };

    me.refreshSeries = function(beginTime, endTime)
    {
        var self = this;
        try
        {
            self.db.getData(self.dataSources[self.currentDataSource].db_server, self.dataSources[self.currentDataSource].db_name, self.dataSources[self.currentDataSource].db_group,
                    self.dataSources[self.currentDataSource].channels, beginTime + '-' + endTime,
                    self.pointCount, self.dataSources[self.currentDataSource].aggregation, function(obj)
            {
                self.dataSourceLevel = self.db.level.window;
                if (obj === null)
                {
                    self.currentDataSource++;
                    self.refreshChartFromMasterChart(beginTime, endTime);                                     
                    self.dataSourcesToChannels.push(self.dataSources[self.currentDataSource].db_server  + ' '
                        + self.dataSources[self.currentDataSource].db_name  + ' ' 
                        + self.dataSources[self.currentDataSource].db_group);            
                    console.log('No data in server responces');
                    return;
                }
                else
                {   
                    for (var i = 0; i < obj.data.length; i++)
                    {             
                        var series = self.parseData(obj, i);
                        series.dataSource = self.dataSources[self.currentDataSource].db_server + ' ' + self.dataSources[self.currentDataSource].db_name + ' ' + self.dataSources[self.currentDataSource].db_group;
                        self.addSeries(series, false);                       
                        self.dataSourcesToChannels.push(self.dataSources[self.currentDataSource].db_server  + ' '
                        + self.dataSources[self.currentDataSource].db_name  + ' ' 
                        + self.dataSources[self.currentDataSource].db_group);
                    }
                    self.currentDataSource++;
                    self.refreshChartFromMasterChart(beginTime, endTime);
                }
            });

        }
        catch (ex)
        {     
            self.currentDataSource++;
            self.refreshChartFromMasterChart(beginTime, endTime);           
            self.dataSourcesToChannels.push(self.dataSources[self.currentDataSource].db_server  + ' '
                + self.dataSources[self.currentDataSource].db_name  + ' ' 
                + self.dataSources[self.currentDataSource].db_group);         
            console.log(ex);
        }
    };

    me.renderPreviousState = function()
    {
        var self = this;
        if(!self.stopPropagation)
        {
            var prevWindow = self.historyHandler.getPrevWindow();
            if(prevWindow !== null)
            {   
                self.isHistoryMoving = true;                
                self.resetYAxisAfterRenderTime = true;
                self.resetXAxisAfterRenderTime = false;              
                self.refreshChart(prevWindow.beginTime, prevWindow.endTime);
                self.masterChart.changePlotbands(prevWindow.beginTime * 1000, prevWindow.endTime * 1000);                 
            }            
        }
    };

    me.renderNextState = function()
    { 
        var self = this;
        if(!self.stopPropagation)
        {
            var nextWindow = self.historyHandler.getNextWindow();
            if(nextWindow !== null)
            {
                self.isHistoryMoving = true;               
                self.resetYAxisAfterRenderTime = true;
                self.resetXAxisAfterRenderTime = false;                
                self.refreshChart(nextWindow.beginTime, nextWindow.endTime);
                self.masterChart.changePlotbands(nextWindow.beginTime * 1000, nextWindow.endTime * 1000);
            }            
        }
    };

    me.setSelectedExtremes = function()
    {
        var self = this;
        for(var i = 0; i < self.chart.yAxis.length; i++)
        {
            var yAxis = self.chart.yAxis[i];
            yAxis.setExtremes(self.selectedYExtremes[i].min, self.selectedYExtremes[i].max, false);
        }    
    };

    me.refreshChartFromMasterChart = function(beginTime, endTime)
    {
        var self = this;   
        beginTime = parseInt(beginTime, 10);
        endTime = parseInt(endTime, 10);    
        if (self.currentDataSource === 0)
        {      
            self.db.dataHandl.deleteWorkers();
            self.addStateInHistory(beginTime, endTime);
            self.stopPropagation = true;
            self.dispose();       
            self.formChartWithEmptySeries();
            self.refreshSeries(beginTime, endTime);   
        }
        else if (self.currentDataSource < self.dataSources.length)
        {
            self.refreshSeries(beginTime, endTime);
        }
        else
        {   
            self.removeSelection();
            self.afterGettingData();
            self.callCallbacks(beginTime, endTime);
            self.currentDataSource = 0;
            self.stopPropagation = false;
            self.setChartTitle();
        }               
    };

    me.afterGettingData = function()
    {
        var self = this;  
        self.chart.redraw();              
        if(self.firstRequest === true)
        {  
            self.setXAxisWithNeedenWindow();   
            self.setUpMetadataInMasterChart();   
            self.refreshMasterChart(self.chart.xAxis[0].min, self.chart.xAxis[0].max);                     
            self.firstRequest = false;               
        }        
        //self.chart.redraw();
        self.rebuildAxesControls(); 
    };

    me.setXAxisWithNeedenWindow = function()
    {
        var self = this;
        var max = self.chart.xAxis[0].max;
        var min = self.chart.xAxis[0].min;              
        if(typeof self.needenWindow.split('-')[1] !== 'undefined')
        {
            var minWindow = parseInt(self.needenWindow.split('-')[0], 10) * 1000;
            var maxWindow = parseInt(self.needenWindow.split('-')[1], 10) * 1000;
            if(minWindow >= min && maxWindow <= max && minWindow < maxWindow)
            {
                min = minWindow;
                max = maxWindow;
            }
        }
        else
        {
            var diffrence = max - min;                    
            if(diffrence > (parseInt(self.needenWindow, 10) * 1000))
            {
                min = max - parseInt(self.needenWindow, 10) * 1000;
            }
        }  
        self.chart.xAxis[0].setExtremes(min, max);    
    };

    me.refreshMasterChart = function(beginTime, endTime)
    {
        var self = this;
        if(self.masterChart.chart !== null)
        {
            self.masterChart.dispose();
        }
        if(self.masterChart.series.length === 0)
        {
            var masterSeries = {};
            masterSeries.data = self.series[0].data;
            masterSeries.name = self.series[0].name;
            self.masterChart.renderMasterChar(self.masterChartId, masterSeries, self.masterChartSeriesNumber);                            
        }      
        self.masterChart.changePlotbands(beginTime, endTime);
    };

    me.parseData = function(obj, i)
    {
        var self = this;
        var series = {yAxis: 0, data: [], name: '', pointInterval: self.dataSourceLevel * 1000};
        series.data = (obj.data[i]);
        series.name = obj.label[i];
        var name = obj.label[i];
        for(var k = 0; k < self.dataSources[self.currentDataSource].axesToChannels.length; k++)
        {
            if(self.dataSources[self.currentDataSource].axesToChannels[k].channelName === name)
            {
                series.channelNumber =  self.dataSources[self.currentDataSource].axesToChannels[k].channelNumber; 
                if(self.dataSources[self.currentDataSource].axesToChannels[k].currentAxis !== null)
                {
                    series.yAxis = self.dataSources[self.currentDataSource].axesToChannels[k].currentAxis;                                       
                }      
                else
                {
                    series.yAxis = 'standart';
                }                          
                break;
            }                      
        } 
    	if(series.yAxis !== 0)
    	{
    	    series.color = self.chart.get(series.yAxis) !== null ? self.chart.get(series.yAxis).options.labels.style.color : self.chart.yAxis[0].options.labels.style.color;    
    	}
    	else
    	{
    	    series.color = self.chart.yAxis[0].options.labels.style.color;
    	}               
        for (var j = 0; j < obj.data[i].length; j++)
        {
            var pointData = self.filterPointData(obj.data[i][j]);               
            series.data[j] = [];  
            series.data[j].push(parseFloat(obj.dateTime[j]) * 1000);            
            series.data[j].push(pointData);                      
        }

        series.zIndex = 1;
        self.aggregateData(series.data);
        return series;
    };

    me.filterPointData = function(pointData)
    {
        var self = this;
        var value = pointData;
        for(var i = 0; i < self.filters.length; i++)
        {
            switch (typeof self.filters[i])
            {
                case 'number':
                    if(self.filters[i] === pointData)
                    {
                        value = null;
                        return null;
                    }                    
                    break;
                case 'function':
                    value = self.filters[i](pointData);        
                    break;
                case 'object':
                    if(self.filters[i][0] > self.filters[i][1])
                    {
                        value = pointData;
                    }
                    else 
                    {
                        if(pointData >= self.filters[i][0] && pointData <= self.filters[i][1])
                        {
                            value = null;
                            return null;                            
                        }
                        else
                        {
                            value = pointData;
                        }
                    }
                    break;
                default:
                    value = pointData;                    
            }
        }
        return value;
    };

    me.zoomChart = function(beginTime, endTime, refreshAfterTimeOut)
    {
        var self = this;       
        var xAxis = self.chart.xAxis[0];
        var yAxis = self.chart.yAxis[0];
        beginTime = self.initialBeginTime <= beginTime ? beginTime : self.initialBeginTime;
        endTime = self.initialEndTime >= endTime ? endTime : self.initialEndTime;
        
        xAxis.setExtremes(beginTime * 1000, endTime * 1000);
        self.masterChart.changePlotbands(beginTime * 1000, endTime * 1000);

        if (refreshAfterTimeOut)
        {
            self.timer = setTimeout(function()
            {
                if(!self.stopPropagation)
                {
                    self.refreshChart(beginTime, endTime);
                }                
            }, 100);
        }
              
    };

    me.onScrollZoom = function(event)
    {
        var self = this;
        clearTimeout(self.timer);
        var e = window.event || event;
        self.delta = self.delta + Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
        var btime = self.chart.xAxis[0].min / 1000;
        var etime = self.chart.xAxis[0].max / 1000;
        var diffrence = (etime - btime) / self.chart.chartWidth * self.zoomMultiplier;
        var begTime = btime + (diffrence * self.delta);
        var endTime = etime - (diffrence * self.delta);
        self.delta = 0;
        self.zoomChart(begTime, endTime, true);

    };

    me.zoomIn = function(e)
    {
        var self = this;
        //window.event.stopPropagation();
        //window.event.cancelBubble = true;
        var beginTime = self.chart.xAxis[0].min + ((self.chart.xAxis[0].max - self.chart.xAxis[0].min) / 4);
        var endTime = self.chart.xAxis[0].max - ((self.chart.xAxis[0].max - self.chart.xAxis[0].min) / 4);        
        if(!self.stopPropagation)
        {
            self.zoomChart(beginTime / 1000, endTime / 1000, false);
            self.refreshChart(beginTime / 1000, endTime / 1000);
        }        
    };  

    me.zoomOut = function(e)
    {
        var self = this;
        //window.event.stopPropagation();
        //window.event.cancelBubble = true;
        var beginTime = self.chart.xAxis[0].min - ((self.chart.xAxis[0].max - self.chart.xAxis[0].min) / 4);
        var endTime = self.chart.xAxis[0].max + ((self.chart.xAxis[0].max - self.chart.xAxis[0].min) / 4);
        if(!self.stopPropagation)
        {
            self.zoomChart(beginTime / 1000, endTime / 1000, false);
            self.refreshChart(beginTime / 1000, endTime / 1000);
        }    
    };

    me.bindEvents = function()
    {
        var self = this;
        var chartContainer = document.getElementById(self.id); 
        chartContainer.addEventListener("mousewheel" || "onscroll", self.onScrollZoom.bind(self), false);
        chartContainer.addEventListener('mousedown', self.startDrag.bind(self), false);
        chartContainer.addEventListener('mousemove', self.drag.bind(self), false);
        chartContainer.addEventListener('mouseup', self.stopDrag.bind(self), false);
        window.addEventListener('popstate', self.changeChartState.bind(self));
    };

    me.changeChartState = function(event)
    {
        var self = this;
        if(!self.stopPropagation)
        {
            var prevWindow = event.state ? event.state : null;
            if(prevWindow !== null)
            {   
                self.isHistoryMoving = true;                
                self.resetYAxisAfterRenderTime = true;
                self.resetXAxisAfterRenderTime = false;              
                self.refreshChart(prevWindow.beginTime, prevWindow.endTime);
                self.masterChart.changePlotbands(prevWindow.beginTime * 1000, prevWindow.endTime * 1000);                 
            }            
        }
    };

    me.changeTooltipPosition = function(event)
    {
        var self = this;
        self.tooltipX = event.clientX;
        self.tooltipY = event.clientY;
    };

    me.startDrag = function(event)
    {
        var self = this;
        if (event.which === 1)
        {
            //
            var chartContainer = document.getElementById(self.id);            
            if (!self.dragData)
            {
                var e = event || event;
                var left = e.offsetX;
                var top = e.offsetY;            
                if (left >= self.chart.chartWidth - 100)
                {                        
                    self.dragData = null;
                }
                else if(top >= self.chart.chartHeight - 25)
                {
                    self.dragData = null;
                }
                else if(left <= self.chart.plotLeft)
                {
                    self.dragData = null;
                } 
                else
                {
                    if (self.zoomType === 'xy')
                    {
                        event.cancelBubble = true;
                        event.stopPropagation();
                        document.body.style.cursor = "move";
                        //self.deleteButtons(); 
                        self.removeSelection();                         
                        self.dragData =
                        {
                            x: e.clientX - chartContainer.offsetLeft,
                            y: e.clientY - chartContainer.offsetTop,
                            offsetX: e.offsetX,
                            offsetY: e.offsetY
                        };     
                    }
                    else
                    {
                       document.body.style.cursor = "move";
                        self.dragData =
                        {
                            x: e.clientX - chartContainer.offsetLeft,
                            y: e.clientY - chartContainer.offsetTop
                        }; 
                    }                        
                }  
            }
        }
        else if (event.which === 2)
        {
            self.resetYAxis();
        }
    };

    me.drag = function(event)
    {
        var self = this;

        if (self.dragData)
        {
            var e = event || event;
            var diff;
            var btime;
            var etime;

            if (self.previousStateX === null || self.previousStateY === null)
            {
                self.previousStateX = e.clientX;
                self.previousStateY = e.clientY;
            }

            var mapDiffX = self.previousStateX - e.clientX;
            var mapDiffY = self.previousStateY - e.clientY;

            var begTime = self.chart.xAxis[0].min / 1000;
            var endTime = self.chart.xAxis[0].max / 1000;         
            var multiplier = (endTime - begTime) / self.chart.chartWidth;            
            if (self.zoomType === 'xy')
            {    
                var xAxis = self.chart.xAxis[0];
                var yAxis = self.chart.yAxis[0];
                xAxis.removePlotBand('zoomplotband');
                yAxis.removePlotBand('zoomplotband');
                self.resetYAxisAfterRenderTime = false;
                self.resetXAxisAfterRenderTime = false;
                //typeof self.rect !== 'undefined' ? self.rect.destroy(); :;
                if(self.rect !== null)
                    {self.rect.destroy();}          

                var toValue = xAxis.toValue(self.dragData.offsetX);
                var fromValue = xAxis.toValue(e.chartX);
                var from = toValue < fromValue ? fromValue : toValue; 
                var to = toValue > fromValue ? fromValue : toValue; 

                var toValueY = yAxis.toValue(self.dragData.offsetY);
                var fromValueY = yAxis.toValue(e.chartY);
                var fromY = toValueY < fromValueY ? fromValueY : toValueY; 
                var toY = toValueY > fromValueY ? fromValueY : toValueY;

                var diffX = self.dragData.offsetX > e.chartX ? (self.dragData.offsetX - e.chartX)
                                                             : (e.chartX - self.dragData.offsetX) ; 
                var diffY = self.dragData.offsetY > e.chartY ? (self.dragData.offsetY - e.chartY)  
                                                             : (e.chartY - self.dragData.offsetY);
                if(diffY <= self.chart.chartHeight / 30)
                {                    
                    xAxis.addPlotBand
                    ({
                        from: from,
                        to: to,
                        color: 'rgba(0, 0, 0, 0.2)',
                        id: 'zoomplotband'
                    });
                    self.resetYAxisAfterRenderTime = true;
                }
                if(diffX <= self.chart.chartWidth / 30)
                {
                    yAxis.addPlotBand
                    ({
                        from: fromY,
                        to: toY,
                        color: 'rgba(0, 0, 0, 0.2)',
                        id: 'zoomplotband'
                    });
                    self.resetXAxisAfterRenderTime = true;                    
                }

                var x = e.chartX;
                var y = e.chartY;
                var sx = self.dragData.offsetX;
                var sy = self.dragData.offsetY;
                var posX;
                var posY;
                var width;
                var height;
                if(x < sx && y < sy)
                {
                    posX = x;
                    posY = y;
                    width = sx - x;
                    height = sy - y;
                } 
                else if(x > sx && y < sy)
                {
                    posX = sx;
                    posY = y;
                    width = x - sx;
                    height = sy - y;
                }
                else if(x < sx && y > sy)
                {
                    posX = x;
                    posY = sy;
                    width = sx - x;
                    height = y - sy;
                }
                else if(x > sx && y > sy)
                {
                    posX = sx;
                    posY = sy;
                    width = x - sx;
                    height = y - sy;
                }


                self.rect = self.chart.renderer.rect(posX, posY, width, height)
                    .attr
                    ({
                        fill: 'rgba(0, 0, 0, 0.2)',
                        zIndex: 1
                    })
                    .add();       
            }
            else
            {
                var begTime = self.chart.xAxis[0].min / 1000;
                var endTime = self.chart.xAxis[0].max / 1000;         
                var multiplier = (endTime - begTime) / self.chart.chartWidth;
                btime = begTime + mapDiffX * multiplier;
                etime = endTime + mapDiffX * multiplier;
                var yAxis;
                for(var i = 0; i < self.chart.yAxis.length; i++)
                {
                    yAxis = self.chart.yAxis[i];
                    var max = yAxis.max;
                    var min = yAxis.min;
                    var multiplierY = (max - min) / self.chart.chartHeight;
                    var minY = min - mapDiffY * multiplierY;
                    var maxY = max - mapDiffY * multiplierY;

                    if(yAxis.oldUserMax !== maxY &&
                        yAxis.oldUserMin !== minY &&
                        yAxis.oldMax !== maxY &&
                        yAxis.oldMin !== minY)
                    {
                        yAxis.options.startOnTick = false;
                        yAxis.options.endOnTick = false;
                        yAxis.options.tickInterval = yAxis.tickInterval;
                        yAxis.setExtremes(minY, maxY);
                    }                    
                }
                self.zoomChart(btime, etime, false);   
            }
            self.previousStateX = e.clientX;
            self.previousStateY = e.clientY;
        }
    };

    me.stopDrag = function(event)
    {
        var self = this;
        if (self.dragData)
        {
            self.rebuildAxesControls();
            if(self.zoomType === 'xy')
            {
                self.dragData = null;
                self.previousStateX = null;
                self.previousStateY = null;
                var box = self.rect.getBBox();
                var xAxis = self.chart.xAxis[0];
                var beginTime = self.resetXAxisAfterRenderTime ? xAxis.min : xAxis.toValue(box.x);
                var endTime = self.resetXAxisAfterRenderTime ? xAxis.max : xAxis.toValue(box.x + box.width);
                self.selectedXExtremes = {beginTime: beginTime, endTime: endTime};
                self.callCallbacks(beginTime / 1000, endTime / 1000);
                self.setUpYExtremes(box);
                self.renderButtons(event);     
                event.cancelBubble = true;
                event.stopPropagation();                    
                document.body.style.cursor = "default";
            }
            else
            {
                var btime = self.chart.xAxis[0].min / 1000;
                var etime = self.chart.xAxis[0].max / 1000;                
                document.body.style.cursor = "default";
                if(!self.stopPropagation)
                {
                    self.refreshChart(btime, etime);
                }            
                self.dragData = null;
                self.previousStateX = null;
                self.previousStateY = null;
            }               
        }
    };

    me.removeSelection = function(e)
    {
        var self = this;                
        self.deleteButtons();
        var xAxis = self.chart.xAxis[0];
        var yAxis = self.chart.yAxis[0];
        xAxis.removePlotBand('zoomplotband');
        yAxis.removePlotBand('zoomplotband');       
        if(self.rect !== null)
        {
            self.rect.destroy();
            self.rect = null;
        }
        self.callCallbacks(xAxis.min / 1000, xAxis.max / 1000); 
    };

    me.setUpYExtremes = function(box)
    {
        var self = this;
        self.selectedYExtremes = [];
        for(var i = 0; i < self.chart.yAxis.length; i++)
        {
            var yAxis = self.chart.yAxis[i];
            var min = self.resetYAxisAfterRenderTime ? yAxis.min : yAxis.toValue(box.y + box.height);
            var max = self.resetYAxisAfterRenderTime ? yAxis.max : yAxis.toValue(box.y);
            var extremes = {min: min, max: max};
            self.selectedYExtremes.push(extremes);
        }
    };

    me.resetYAxis = function()
    {
        var self = this;       
        for(var i = 0; i < self.chart.yAxis.length; i++)
        {
            var yAxis = self.chart.yAxis[i];
            var max = yAxis.getExtremes().dataMax;
            var min = yAxis.getExtremes().dataMin;

            var margin = (max - min) / 10;
            yAxis.options.startOnTick = false;
            yAxis.options.endOnTick = false;
            yAxis.tickInterval = undefined;
            yAxis.options.tickInterval = undefined;
            //self.chart.yAxis[i].options.tickInterval = (yAxis.getExtremes().dataMax - yAxis.getExtremes().dataMin) / 8;
            yAxis.setExtremes(min - margin, max + margin, false);
        }
        self.chart.redraw();
        self.rebuildAxesControls();
    };

    me.tooltipPosition = function()
    {
        var self = this;
        return {x: self.tooltipX, y: self.tooltipY};
    };


    me.getDivWidth = function(id)
    {
        return document.getElementById(id).offsetWidth;
    };

    me.getDivHieght = function(id)
    {
        return document.getElementById(id).offsetHeight;
    };

    me.formTitle = function()
    {
        var self = this;
        var title = '';
        for (var i = 0; i < self.dataSources.length; i++)
        {
            var db_server = self.dataSources[i].db_server;
            var db_name = self.dataSources[i].db_name;
            var db_group = self.dataSources[i].db_group;
            var level = self.db.level.window;
            title = title + db_server + ' ' + db_name + ' ' + db_group + ', resolution: ' + level;
        }
        return title;
    };

    me.hideLegend = function()
    {
        var self = this;
        var begTime = self.chart.xAxis[0].min;
        var endTime = self.chart.xAxis[0].max;
        var max = [];        
        var min = []; 
        for(var i = 0; i < self.chart.yAxis.length; i++)
        {
            max.push(self.chart.yAxis[i].max);
            min.push(self.chart.yAxis[i].min);
        }   


        self.isLegendEnabled = false;
        self.formChart(self.id, self.series);
        self.chart = jQuery('#' + self.id).highcharts();
        for(i = 0; i < self.chart.yAxis.length; i++)
        {
            self.chart.yAxis[i].options.startOnTick = false;
            self.chart.yAxis[i].options.endOnTick = false;
            self.chart.yAxis[i].setExtremes(min[i], max[i], false);
        }    
        
        self.chart.xAxis[0].setExtremes(begTime, endTime, false);        
        self.masterChart.changePlotbands(begTime, endTime);
        self.chart.redraw();
        self.rebuildAxesControls();


};


    me.resetXAxis = function(e)
    {
        var self = this;
        window.event.cancelBubble = true;
        window.event.stopPropagation();
        if(!self.stopPropagation)
        {
            self.setUpNeedenExtremes = false; 
            self.refreshChart(parseInt(self.initialBeginTime, 10), parseInt(self.initialEndTime, 10));
            self.masterChart.changePlotbands(parseInt(self.initialBeginTime, 10) * 1000, parseInt(self.initialEndTime, 10) * 1000); 
            self.resetYAxis();
       }
    };

    me.rebuildAxesControls = function()
    {
        var self = this;
        jQuery(".axisControl").remove();
        jQuery(".xAxisControl").remove();

        var yAxes = document.getElementsByClassName("highcharts-axis-labels highcharts-yaxis-labels");  
        var xAxisSize = document.getElementsByClassName("highcharts-axis-labels highcharts-xaxis-labels")[1].getBBox();
        var labelGroupBBox = self.chart.renderer.rect(xAxisSize.x, xAxisSize.y, xAxisSize.width, xAxisSize.height)
        .attr({
            class: 'xAxisControl',
            fill: '#fff',
            opacity: 0,
            zIndex: 8
        })
        .css({
            cursor: 'default'
        })
        .add();
        document.getElementsByClassName('xAxisControl')[0].ondblclick = self.resetXAxis.bind(self);          
        for(var i = 0; i < self.chart.yAxis.length; i++)
        {
            var axisBox = yAxes[i + 1].getBBox();
            var yAxis = self.chart.yAxis[i];

            var bBoxWidth = axisBox.width + 20;
            var bBoxHeight = axisBox.height;
            var bBoxX = axisBox.x - 10;
            var bBoxY = axisBox.y;

            labelGroupBBox = self.chart.renderer.rect(bBoxX, bBoxY, bBoxWidth, bBoxHeight)
            .attr({
                class: 'axisControl',
                fill: '#fff',
                opacity: 0,
                zIndex: 8
            })
            .css({
                cursor: 'ns-resize'
            })
            .add();

            var isDragging = false;
            var isDraggingMaxExtreme = false;
            var isDraggingMinExtreme = false;
            var downYValue;

            var rectangles = document.getElementsByClassName('axisControl');
            var mooveDiv = document.getElementById('mooveAxesDiv');
            var rect = rectangles[i];           

            rectangles[i].onmousedown = function(yAxis, rect)
            { 
                return function(e)
                {   

                    if(e.which === 1)
                    {
                        isDragging = true;                      
                        //window.event.cancelBubble = true;
                        //window.event.stopPropagation(); 


                        mooveDiv.onmousemove = function(yAxis, rect)
                        { 
                            return function(e)
                            {    
                                window.event.cancelBubble = true;
                                //window.event.stopPropagation();
                                if (isDragging) 
                                {                           
                                    if (self.previousStateX === null && self.previousStateY === null)
                                    {                            
                                        self.previousStateY = e.clientY;
                                    }
                                    var mapDiffY = self.previousStateY - e.clientY;

                                    var max = yAxis.max;
                                    var min = yAxis.min;
                                    if(self.divHieght === 0)
                                    {self.divHieght = 800;}
                                    var multiplierY = (max - min) / self.chart.chartHeight;
                                    var minY = parseFloat(min - mapDiffY * multiplierY);
                                    var maxY = parseFloat(max - mapDiffY * multiplierY);   

                                    if(yAxis.oldUserMax !== maxY &&
                                        yAxis.oldUserMin !== minY &&
                                        yAxis.oldMax !== maxY &&
                                        yAxis.oldMin !== minY)
                                    {                        
                                        yAxis.options.startOnTick = false;
                                        yAxis.options.endOnTick = false;
                                        yAxis.options.tickInterval = yAxis.tickInterval;
                                        yAxis.setExtremes(minY, maxY, true, false);                                             
                                    } 

                                }
                                    self.previousStateY = e.clientY;  
                                                
                                             
                                
                            };
                        }(yAxis, rect);

                    mooveDiv.onmouseup = function(yAxis, rect)
                    { 
                        return function(e)
                        {                
                            //window.event.cancelBubble = true;
                            //window.event.stopPropagation();
                            self.rebuildAxesControls();
                            self.previousStateY = null;
                            isDragging = false;    
                            isDraggingMinExtreme = false;
                            isDraggingMaxExtreme = false;                    
                        };
                    }(yAxis, rect);          
                }    
            };
            }(yAxis, rect);

            

           /* rectangles[i].onmouseout = function(yAxis, rect)
            { 
                return function(e)
                {                
                    window.event.cancelBubble = true;
                    window.event.stopPropagation();           
                    self.previousStateY = null;
                    isDragging = false;    
                    isDraggingMinExtreme = false;
                    isDraggingMaxExtreme = false;                    
                };
            }(yAxis, rect);  */         

            rectangles[i].onmousewheel = function(yAxis, rect)
            { 
                return function(e)
                {                      
                    var e = window.event || event;
                    clearTimeout(self.timer);
                    e.stopPropagation();
                    e.cancelBubble = true;
                    self.delta = self.delta + Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
                    var min = yAxis.min;
                    var max = yAxis.max;
                    var diffrence = (max - min) * self.zoomMultiplier * 1.5 / (self.chart.chartHeight);
                    var newMin = min + (diffrence * self.delta);
                    var newMax = max - (diffrence * self.delta);
                    var tick = (newMax - newMin) / 10;   
                    tick = self.getOptimalTick(tick);    
                    newMax = newMax - tick;               
                    self.timer = setTimeout(function()
                    {                
                        var prevTick = yAxis.tickInterval;       
                        yAxis.options.startOnTick = true;
                        yAxis.options.endOnTick = true;                        
                        yAxis.options.tickInterval = (tick);                       
                        yAxis.setExtremes(newMin, newMax, true, true);      
                        yAxis.options.startOnTick = false;
                        yAxis.options.endOnTick = false;                    
                        yAxis.options.tickInterval = undefined;
                        self.delta = 0;                                       
                    }, 200);                    
                };
            }(yAxis, rect);

            rectangles[i].ondblclick = function(yAxis, rect)
            { 
                return function(e)
                {  
                    var max = yAxis.getExtremes().dataMax;
                    var min = yAxis.getExtremes().dataMin;
                    var margin = (max - min) / 10;
                    yAxis.options.startOnTick = false;
                    yAxis.options.endOnTick = false;
                    yAxis.tickInterval = undefined;
                    yAxis.options.tickInterval = undefined;                    
                    yAxis.setExtremes(min - margin, max + margin);    
                };
            }(yAxis, rect);






        }
    };

    me.getOptimalTick = function(tick)
    {
        var count = 1;
        var decimals = 1;
        while(true)
        {
            var figure = Math.round(tick * decimals)/ decimals;
            if(figure === 0)
            {
                count++;
                decimals = decimals * 10;
            }
            else
            {
                break;
            }
        }           
        tick = Math.round(tick * Math.pow(10, count)) / Math.pow(10, count);
        return tick;
    };

    me.resizeCharts = function()
    {
        var self = this;
        var sourceWidth;
        if(document.getElementById('main_sidebar_source').offsetWidth > document.getElementById('main_sidebar_controls').offsetWidth)
        {sourceWidth = document.getElementById('main_sidebar_source').offsetWidth;}
        else{sourceWidth = document.getElementById('main_sidebar_controls').offsetWidth;}
        self.chart.setSize(
            jQuery(window).width() - sourceWidth, 
            jQuery(window).height() - document.getElementById('header_div').offsetHeight - 100  - 70,
            true
        ); 
        self.masterChart.chart.setSize(
            jQuery(window).width() - sourceWidth,
            150
        );
        self.rebuildAxesControls();
        self.masterChart.rebuildControls(jQuery(window).width() - sourceWidth);
    };

    me.showLegend = function()
    {
        var self = this;
        var begTime = self.chart.xAxis[0].min;
        var endTime = self.chart.xAxis[0].max;
        var max = [];        
        var min = []; 
        for(var i = 0; i < self.chart.yAxis.length; i++)
        {
            max.push(self.chart.yAxis[i].max);
            min.push(self.chart.yAxis[i].min);
        }   

        self.isLegendEnabled = true;
        self.formChart(self.id, self.series);
        self.chart = jQuery('#' + self.id).highcharts();
        for(i = 0; i < self.chart.yAxis.length; i++)
        {
            self.chart.yAxis[i].options.startOnTick = false;
            self.chart.yAxis[i].options.endOnTick = false;
            self.chart.yAxis[i].setExtremes(min[i], max[i], false);
        }            
        self.chart.xAxis[0].setExtremes(begTime, endTime, false);
        self.masterChart.changePlotbands(begTime, endTime);
        self.chart.redraw();
        self.rebuildAxesControls();
    };

    me.showLabels = function(e)
    {
        var self = this;
        jQuery('.aedialog').remove();
        if(chart.rect === null)
        {
            var points = [];        
            var msg = '<div class="ui-dialog">';
            var heightY = chart.chart.plotHeight / 500;        
            var clientY = this.plotY;
            var max = clientY + heightY;
            var min = clientY - heightY;
            var seriesToMove;
            var dataSourceOfMovingSeries;
            var filterValue;
            for(var i = 0; i < chart.chart.series.length; i++)
            {            
                var minx = chart.chart.series[i].xAxis.min;
                var maxx = chart.chart.series[i].xAxis.max;
                var diffrencex = (maxx - minx) / 200; 
                for(var j = 0; j < chart.chart.series[i].points.length; j++)
                {                             
                    var y = chart.chart.series[i].points[j].plotY;  
                    var date = chart.chart.series[i].points[j].x;
                    var value = chart.chart.series[i].points[j].y;                    
                    if(date <= (this.x + diffrencex) && date >= (this.x - diffrencex) 
                        && y <= (max) && y >= (min))
                    {
                        seriesToMove = chart.chart.series[i];
                        dataSourceOfMovingSeries = chart.dataSourcesToChannels[i];
                        msg = msg + '</br><strong>Data source:</strong>' + chart.dataSourcesToChannels[i] +
                         '</br><strong>Channel:</strong> ' + chart.chart.series[i].name + 
                         '</br><strong>Date:</strong> ' + Highcharts.dateFormat('%Y-%m-%d %H:%M:%S.%L', date) + 
                         '</br><strong>Value:</strong> ' + value + '</br>';
                         filterValue = value;
                        break;
                    }           
                }
            }    
            var buttons = {"Add last value in filter": function()
                    {
                        chart.addFilter(filterValue);                       
                        chart.refreshChartInCurrentExtremes();
                    }
                };    
            var axesRelations = chart.getAxesRelations(dataSourceOfMovingSeries); 
            if(seriesToMove.yAxis.options.id === 'temporary')
            {
               buttons =  {"Delete this series from the temporary axis": function()
                {
                    var flag;
                    var needenAxis;
                    if(seriesToMove.yAxis.series.length === 1)
                    {
                        flag = true;                  
                    } 
                    for(var i = 0; i < axesRelations.length; i++)
                    {
                        if(seriesToMove.options.channelNumber === axesRelations[i].channelNumber)
                        {
                            needenAxis = axesRelations[i].currentAxis = axesRelations[i].value;
                            break;
                        }
                    }                           
                    var jSONSeries = JSON.stringify(seriesToMove.options);
                    var series = JSON.parse(jSONSeries);                    
                    seriesToMove.remove();
                    series.yAxis = needenAxis;
                    series.color = chart.chart.get(needenAxis).options.labels.style.color;
                    series.lineWidth = 1;
                    chart.chart.addSeries(series, true);                    
                    if(flag)
                    {
                        var temporaryAxis = chart.chart.get('temporary');
                        temporaryAxis.remove();
                        chart.axesToShow.splice(chart.axesToShow.length, 1);
                    }           
                    chart.rebuildAxesControls();   
                },
                "Add last value in filter": function()
                {
                    chart.addFilter(filterValue);
                    chart.refreshChartInCurrentExtremes();
                }
                };                   
            }
            else
            {
                if(seriesToMove.yAxis.series.length !== 1)
                {            
                    buttons = {"Show last series on another axis": function()
                    {   
                        for(var i = 0; i < axesRelations.length; i++)
                        {
                            if(seriesToMove.options.channelNumber === axesRelations[i].channelNumber)
                            {                            
                                axesRelations[i].currentAxis = 'temporary';
                                break;
                            }
                        }
                        var temporaryAxis = chart.chart.get('temporary');
                        if(!temporaryAxis)
                        {
                            chart.chart.addAxis(chart.temporaryAxis, false, false);                        
                        }                      
                        var jSONSeries = JSON.stringify(seriesToMove.options);
                        var series = JSON.parse(jSONSeries);
                        seriesToMove.remove();
                        series.yAxis = 'temporary';
                        series.color = chart.temporaryAxis.labels.style.color;
                        series.lineWidth = 1;
                        chart.chart.addSeries(series, true);
                        chart.rebuildAxesControls();                                   
                    },
                    "Add last value in filter": function()
                    {
                        chart.addFilter(filterValue);                       
                        chart.refreshChartInCurrentExtremes();
                    }
                    };
                 }
            }
            msg = msg + '</div>';
            jQuery(msg).dialog({
                dialogClass: 'aedialog',
                title: 'Point info',
                position: {my: 'right top', of: e},
                closeText: 'Close',
                width: 'auto',
                maxWidth: 1000,
                height: 'auto',
                buttons: buttons            
            });
        }

    };

    me.getAxesRelations = function(dataSource)
    {
        var self = this;
        dataSource = dataSource.split(' ');
        for (var i = 0; i < self.dataSources.length; i++)
        {
            if (self.dataSources[i].db_server === dataSource[0] &&
                    self.dataSources[i].db_name === dataSource[1] &&
                    self.dataSources[i].db_group === dataSource[2])

            {
                return self.dataSources[i].axesToChannels;
            }
        }
    }

    me.formDataSources = function(dataSource)
    {
        var self = this;
        if (self.dataSources.length === 0)
        {
            self.dataSources.push(dataSource);
        }
        else
        {
            var flag = false;
            for (var i = 0; i < self.dataSources.length; i++)
            {
                if (self.dataSources[i].db_server === dataSource.db_server &&
                        self.dataSources[i].db_name === dataSource.db_name &&
                        self.dataSources[i].db_group === dataSource.db_group &&
                        self.dataSources[i].aggregation === dataSource.aggregation)

                {
                    flag = true;
                    self.dataSources[i].channels = dataSource.channels;
                    break;
                }
            }
            if (!flag)
            {
                self.dataSources.push(dataSource);
            }
        }

    };

    me.dispose = function()
    {
        var self = this;
        if(self.chart !== null)
        {
            self.chart.destroy();               
        }        
        self.dataSourcesToChannels = [];
        self.series = [];
    };

    me.formChartWithEmptySeries = function()
    {
        var self = this;
        self.formChart(self.id, []);
        self.chart = jQuery('#' + self.id).highcharts();
    };


    me.formVirtualSources = function(srctree)
    {
        var virtualSources = [];    
        for(var i = 0; i < srctree.length; i++)
        {
            var flag = false;
            var virtualSource = {};
            var group = srctree[i].split('__');
            if(typeof group[0] !== 'undefined' &&
               typeof group[1] !== 'undefined' &&
               typeof group[2] !== 'undefined' &&
               typeof group[3] !== 'undefined')
            {
                virtualSource.db_server = group[0];
                virtualSource.db_name = group[1];
                virtualSource.db_group = group[2];
                virtualSource.channels = group[3];
                for(var j = 0; j < virtualSources.length; j++)
                {
                    if(virtualSources[j].db_server === virtualSource.db_server &&
                       virtualSources[j].db_name === virtualSource.db_name &&
                       virtualSources[j].db_group === virtualSource.db_group)
                    {
                        flag = true;
                        virtualSources[j].channels = virtualSources[j].channels +  ',' + (virtualSource.channels);                       
                        break;
                    }
                }
                if(!flag)
                {                                  
                    virtualSources.push(virtualSource);
                }
                
            }
        }
        return virtualSources;

    };

    me.getSeries = function(id)
    {
        return this.series[id];
    };

    me.addAxis = function(axis)
    {
        this.chart.addAxis(axis, false, false);

    };

    me.changeZoomTypeToMap = function()
    {
        var self = this;
        self.zoomType = '';       
    };

    me.changeZoomTypeToXY = function()
    {
        var self = this;
        self.zoomType = 'xy';      
    };

    me.changeMasterChartSeries = function(seriesId)
    {
        if (seriesId > this.series.length && seriesId < 0)
        {
            return;
        }
        this.masterChart.renderMasterChar(this.masterChartId, this.series[seriesId],  this.masterChartSeriesNumber);
    };

    me.addSeries = function(series, isRedraw)
    {
        this.series.push(series);
        series.lineWidth = 1;        
        this.chart.addSeries(series, isRedraw);
    };

    me.addSeriesToMasterChart = function()
    {

    };

    me.addDataSource = function(dataSource, beginTime, endTime)
    {        

        this.formDataSources(dataSource);
        this.refreshChartFromMasterChart(beginTime, endTime);

    };

    me.getExperimentInterval = function(dataSource)
    {
        var self = this;
        var url = self.db.formURLInfo(dataSource.db_server, dataSource.db_name, dataSource.db_group, 'cache');        
        var responseXML = self.db.httpGetXml(url);
        var item = responseXML ? responseXML.getElementsByTagName('Value') : [];
        if(typeof item[0] !== 'undefined')
        {
            var beginTime = item[0].getAttribute('first');
            var endTime = item[0].getAttribute('last');
            return beginTime + '-' + endTime;
        }
        else
        {
            throw 'Error while getting experiment interval from the server.';
        }
    };


    me.getDataSourcePeriod = function(dataSource)
    {
        var self = this;
        var url = self.db.formURLList(dataSource.db_server, dataSource.db_name, dataSource.db_group, 'max_resolution');              
        var responseXML = self.db.httpGetXml(url);
        var item = responseXML ? responseXML.getElementsByTagName('Value') : [];
        var period = item[0].getAttribute('value');  
        return period;

    };

    me.isPriviousRequest = function(dataSources)
    {
        var self = this;
        if(dataSources.length !== self.dataSources.length)
        {return false;}
        for(var i = 0; i < dataSources.length; i++)
        {            
            if(dataSources[i].db_server !== self.dataSources[i].db_server ||
                  dataSources[i].db_name !== self.dataSources[i].db_name ||
                  dataSources[i].db_group !== self.dataSources[i].db_group ||
                  dataSources[i].channels !== self.dataSources[i].channels)
            {
                return false;
            }
        }
        return true;
    };

    me.getAllAxes = function(dataSource)
    {
        var self = this;
        var url = self.db.formURLList(dataSource.db_server, dataSource.db_name, dataSource.db_group, 'axes');              
        var responseXML = self.db.httpGetXml(url);
        var axes = responseXML ? responseXML.getElementsByTagName('Value') : [];
        var axesArray = [];        
        for(var i = 0; i < axes.length; i++)
        {
            var axisObj = {};
            axisObj.id = i;
            axisObj.value = axes[i].getAttribute('value');
            axisObj.units = axes[i].getAttribute('axis_units');
            axisObj.name = axes[i].getAttribute('axis_name');
            axesArray.push(axisObj);
        }
        return axesArray;
    };

    me.formURLAxes = function(db_server, db_name, db_group, db_channels, target)
    {
        var url = this.hostURL + '/services/list.php?db_server=' + db_server
                + '&db_name=' + db_name
                + '&db_group=' + db_group
                + '&db_mask=' + db_channels
                + '&target=' + target
                + '&info=1';
        return url;
    };

    me.formURLMetadata = function(db_server, db_name, db_group, db_channels, experiment, resolution, target)
    {
        var url = this.hostURL + '/services/cache.php?db_server=' + db_server
                + '&db_name=' + db_name
                + '&db_group=' + db_group
                + '&db_mask=' + db_channels
                + '&target=' + target
                + '&experiment=' + experiment
                + '&resolution=' + resolution
        return url;
    };
    
    me.httpGetText = function(url)
    {
    	var xmlHttp = null;	
    	xmlHttp = new XMLHttpRequest();
    	xmlHttp.open("GET", url, false);
    	xmlHttp.send(null);
    	return xmlHttp.response;
    };

    me.setUpMetadataInMasterChart = function()
    {
        var self = this;
        var res = self.db.level.window;
        var urlMissingPoints = self.formURLMetadata(self.dataSources[0].db_server, self.dataSources[0].db_name,
                                self.dataSources[0].db_group, self.dataSources[0].channels, 
                                self.initialBeginTime + '-' + self.initialEndTime, res,
                                'missing_points');

        var urlPointCount = self.formURLMetadata(self.dataSources[0].db_server, self.dataSources[0].db_name,
                                self.dataSources[0].db_group, self.dataSources[0].channels, 
                                self.initialBeginTime + '-' + self.initialEndTime, res,
                                'point_count');
        var csvMissingPoints = self.httpGetText(urlMissingPoints);
        var csvPointCount = self.httpGetText(urlPointCount);
        self.masterChart.setSeriesMissingPoints(self.parseCsv(csvMissingPoints));
        self.masterChart.setSeriesPointCount(self.parseCsv(csvPointCount));
    };


    me.renderMissingPoints = function()
    {
        var self =  this;
        self.masterChart.renderMissingPoints();
        self.setChartTitle();
    };

    me.renderPointCounts = function()
    {
        var self =  this;
        self.masterChart.renderPointCounts();
        self.setChartTitle();
    };

    me.renderFirstSeries = function()
    {
        var self = this;
        self.masterChart.renderData();
        self.setChartTitle();
    };

    me.parseCsv = function(msg)
    {
        var self = this;
        var rows = msg.split(self.db.dataHandl.lineSeparator);
        var channelCount = rows[0].split(',');   
        var series = {data: [], name: ''}; 
        series.name = rows[0].split(',')[1];       
        for (var i = 1; i < rows.length - 1; i++)
        {
            var rowdata = rows[i].split(',');
            var time = rowdata[0]; 
            var value = rowdata[1];
            series.data.push([parseFloat(time * 1000, 10), parseFloat(value, 10)]);           
        }    
        return series;           
    };


    me.stringtoXML = function(text)
    {
        var doc;
        if (window.ActiveXObject)
        {
    	    doc = new window.ActiveXObject('Microsoft.XMLDOM');
    	    doc.async='false';
    	    doc.loadXML(text);
        } 
        else 
        {
    	    var parser = new window.DOMParser();
        	doc = parser.parseFromString(text,'text/xml');
	    }
	   return doc;
    };

    me.formNeedenAxes = function(dataSource)
    {
        var self = this;
        var url = self.formURLAxes(dataSource.db_server, dataSource.db_name, dataSource.db_group, dataSource.channels, 'items');              
        var responseXML = self.stringtoXML(self.httpGetText(url));
        var items = responseXML ? responseXML.getElementsByTagName('Value') : [];
        var axesArray = [];        
        for(var i = 0; i < items.length; i++)
        {
            var axisObj = {};
            axisObj.channelNumber = items[i].getAttribute('value');
            axisObj.channelName = items[i].getAttribute('name');
            axisObj.value = items[i].getAttribute('axis'); 
            axisObj.currentAxis = items[i].getAttribute('axis');
            axesArray.push(axisObj);
        }
        return axesArray;
    };

    me.formAxesInfo = function(dataSource)
    {
        var self = this;
        var needenAxes = self.formNeedenAxes(dataSource);        
        //self.axesToChannels = self.axesToChannels.concat(needenAxes);
        
        dataSource.axesToChannels = needenAxes;

        var needenIds = [];
        needenIds.push(dataSource.axesToChannels[0]);
        var flag;
        for (var i = 0; i < dataSource.axesToChannels.length; i++)
        {
            flag = false;
            for(var j = 0; j < needenIds.length; j++)
            {
                if(needenIds[j].value === dataSource.axesToChannels[i].value)
                {
                    flag = true;
                    break;
                }                
            }
            if(!flag)
            {    
                needenIds.push(dataSource.axesToChannels[i]);                
            }
        }

        self.needenAxes = needenIds;
        var axesToShow = [];
        var counter = 1;
        flag = false;
        for(var i = 0; i < self.axes.length; i++)
        {
    	    if(counter > Highcharts.getOptions().colors.length - 1)
    	    {
    	        counter = 1;
    	    }
            var axesObj = {value: '',labels: {format: '{value} ', style: { color: Highcharts.getOptions().colors[counter]}}, title: {text: '', style: { color: Highcharts.getOptions().colors[counter]}}};
            counter++;
            for(var j = 0; j < self.needenAxes.length; j++)
            {
            	if(typeof self.needenAxes[j] === 'undefined')
                {
            	    flag = true;
            	    axesToShow.push({gridLineWidth: 0, id: 'standart',labels: {format: '{value}', style: { color: Highcharts.getOptions().colors[0]}}, title: {text: 'Standart axis', style: { color: Highcharts.getOptions().colors[0]}}});
            	    continue;    	    
            	}
            	else
            	{        	    
                	    if(self.needenAxes[j].value === null && flag === false)
                	    {
                        	flag = true;
                        	axesToShow.push({gridLineWidth: 0, id: 'standart',labels: {format: '{value}', style: { color: Highcharts.getOptions().colors[0]}}, title: {text: 'Standart axis', style: { color: Highcharts.getOptions().colors[0]}}});
                        	continue;
                	    }
            	}            	 
                if(self.needenAxes[j].value === self.axes[i].value)
                {
                    if(j !== 0)
                    {
                        axesObj.gridLineWidth = 0;
                    }                    
                    axesObj.id = self.axes[i].value;
                    axesObj.labels.format = axesObj.labels.format + self.axes[i].units;
                    axesObj.title.text = self.axes[i].name;      
                    axesObj.startOnTick = false;
                    axesObj.endOnTick = false;      
                    axesToShow.push(axesObj);
                }
            }

        }

        for (var i = 0; i < axesToShow.length; i++)
        {
            var flag = false;
            for(var j = 0; j < self.axesToShow.length; j++)
            {
                if(axesToShow[i].id === self.axesToShow[j].id)
                {
                    flag = true;
                    break;
                }                
            }
            if(!flag)
            {
                self.axesToShow.push(axesToShow[i]);                
            }
        }
        if(self.axesToShow.length === 0)
        {
            self.axesToShow.push({gridLineWidth: 0, id: 'standart',labels: {format: '{value}', style: { color: Highcharts.getOptions().colors[0]}}, title: {text: 'Standart axis', style: { color: Highcharts.getOptions().colors[0]}}});
        }
    };

    me.buildControls = function(width)
    {
        var self = this;
        var chart = document.getElementsByClassName("highcharts-series-group")[0].getBBox();      
        var pos = jQuery('#' + self.id).position();
        var parent = document.getElementById('moduleChart');  
        self.leftControl = document.createElement('div');
        self.leftControl.className = 'chronoline-left';  
        self.leftControl.style.display = self.controlsVisibility; 
        var leftIcon = document.createElement('div');
        leftIcon.className = 'chronoline-left-icon';
        leftIcon.style.marginTop = '3px';
        leftIcon.style.marginLeft= '4px';
        self.leftControl.appendChild(leftIcon);
        self.leftControl.style.display = true;
        self.leftControl.style.marginTop = 10;
        self.leftControl.style.left = pos.left + self.chart.chartWidth - 97 + 'px';
        self.leftControl.style.top = pos.top + 114 + 'px';
        self.leftControl.style.marginTop = '40px';
        self.leftControl.style.height = ' 20px';    
        self.leftControl.onclick = self.onMovingLeft.bind(self);      
        parent.appendChild(self.leftControl);


        self.rightControl = document.createElement('div');
        self.rightControl.className = 'chronoline-left'; 
        self.rightControl.style.display = self.controlsVisibility; 
        var rightIcon = document.createElement('div');
        rightIcon.className = 'chronoline-left-icon';                
        rightIcon.style.marginTop = '3px';
        rightIcon.style.marginLeft= '4px';
        self.rightControl.appendChild(rightIcon);
        self.rightControl.style.display = true;
        self.rightControl.style.marginTop = 10;
        self.rightControl.style.left = pos.left + self.chart.chartWidth - 45 + 'px';
        self.rightControl.style.top = pos.top + 114  + 'px';
        self.rightControl.style.marginTop = '40px';
        self.rightControl.style.height = ' 20px'; 
        self.rightControl.style.zIndex = 20;
        self.rightControl.style.webkitTransform = 'rotate('+180+'deg)'; 
        self.rightControl.style.mozTransform    = 'rotate('+180+'deg)'; 
        self.rightControl.style.msTransform     = 'rotate('+180+'deg)'; 
        self.rightControl.style.oTransform      = 'rotate('+180+'deg)'; 
        self.rightControl.style.transform       = 'rotate('+180+'deg)'; 
        self.rightControl.onclick = self.onMovingRight.bind(self);                
        parent.appendChild(self.rightControl);


        self.upControl = document.createElement('div');
        self.upControl.className = 'chronoline-left'; 
        self.upControl.style.display = self.controlsVisibility; 
        var upIcon = document.createElement('div');
        upIcon.className = 'chronoline-left-icon';                
        upIcon.style.marginTop = '3px';
        upIcon.style.marginLeft= '4px'; 
        self.upControl.appendChild(upIcon);
        self.upControl.style.display = true;
        self.upControl.style.marginTop = 10;
        self.upControl.style.left = pos.left + self.chart.chartWidth - 71 + 'px';
        self.upControl.style.top = pos.top +  90 + 'px';
        self.upControl.style.marginTop = '40px';
        self.upControl.style.height = ' 20px';   
        self.upControl.style.webkitTransform = 'rotate('+90+'deg)'; 
        self.upControl.style.mozTransform    = 'rotate('+90+'deg)'; 
        self.upControl.style.msTransform     = 'rotate('+90+'deg)'; 
        self.upControl.style.oTransform      = 'rotate('+90+'deg)'; 
        self.upControl.style.transform       = 'rotate('+90+'deg)';  
        self.upControl.onclick = self.onMovingUp.bind(self);      
        parent.appendChild(self.upControl);

        self.downControl = document.createElement('div');
        self.downControl.className = 'chronoline-left'; 
        self.downControl.style.display = self.controlsVisibility; 
        var downIcon = document.createElement('div');
        downIcon.className = 'chronoline-left-icon';                
        downIcon.style.marginTop = '3px';
        downIcon.style.marginLeft= '4px'; 
        self.downControl.appendChild(downIcon);
        self.downControl.style.display = true;
        self.downControl.style.marginTop = 10; 
        self.downControl.style.left = pos.left + self.chart.chartWidth -  71 + 'px';
        self.downControl.style.top = pos.top + 97 + 'px';
        self.downControl.style.marginTop = '80px';
        self.downControl.style.height = ' 20px';   
        self.downControl.style.webkitTransform = 'rotate('+270+'deg)'; 
        self.downControl.style.mozTransform    = 'rotate('+270+'deg)'; 
        self.downControl.style.msTransform     = 'rotate('+270+'deg)'; 
        self.downControl.style.oTransform      = 'rotate('+270+'deg)'; 
        self.downControl.style.transform       = 'rotate('+270+'deg)';
        self.downControl.onclick = self.onMovingDown.bind(self);              
        parent.appendChild(self.downControl);
    };

    me.onMovingUp = function(e)
    {
        var self = this;
        e.cancelBubble = true;
        e.stopPropagation();
        for(var i = 0; i < self.chart.yAxis.length; i++)
        {
            var yAxis = self.chart.yAxis[i];
            var max = yAxis.max;
            var min = yAxis.min;
            var multiplierY = (max - min) / 6;
            var minY = min + multiplierY;
            var maxY = max + multiplierY;         
            yAxis.options.startOnTick = false;
            yAxis.options.endOnTick = false;
            yAxis.setExtremes(minY, maxY);                              
        }
    };

    me.onMovingDown = function(e)
    {
        var self = this;
        e.cancelBubble = true;
        e.stopPropagation();
        for(var i = 0; i < self.chart.yAxis.length; i++)
        {
            var yAxis = self.chart.yAxis[i];
            var max = yAxis.max;
            var min = yAxis.min;
            var multiplierY = (max - min) / 6;
            var minY = min - multiplierY;
            var maxY = max - multiplierY;         
            yAxis.options.startOnTick = false;
            yAxis.options.endOnTick = false;
            yAxis.setExtremes(minY, maxY);                              
        }
    };

    me.onMovingLeft = function(e)
    {
        var self = this;     
        window.clearTimeout(self.intervalVariable);
        window.event.cancelBubble = true;
        window.event.stopPropagation();
        var xAxis = self.chart.xAxis[0];
        var max = xAxis.max;
        var min = xAxis.min;
        var multiplierX = (max - min) / 4;
        var minX = min - multiplierX;
        var maxX = max - multiplierX;  
        xAxis.options.startOnTick = false;
        xAxis.options.endOnTick = false;  
        minX = minX / 1000 >= parseInt(self.initialBeginTime, 10) ? minX : parseInt(self.initialBeginTime, 10) * 1000;
        maxX = maxX / 1000 <= parseInt(self.initialEndTime, 10) ? maxX : parseInt(self.initialEndTime, 10) * 1000;       
        if(min / 1000 > parseInt(self.initialBeginTime, 10) || max / 1000 < parseInt(self.initialEndTime, 10))
        {
            self.masterChart.changePlotbands(minX, maxX);            
            self.addStateInHistory(minX / 1000, maxX / 1000); 
            self.moovingRightCount++; 
            xAxis.setExtremes(minX, maxX); 
            if(self.moovingRightCount > 3)
            {
                if(!self.stopPropagation)
                {
                    self.refreshChart(minX / 1000, maxX / 1000);
                    self.moovingRightCount = 0;
                }  
            }  
        }                          
    };

    me.onMovingRight = function(e)
    {
        var self = this;     
        window.clearTimeout(self.intervalVariable);
        window.event.cancelBubble = true;
        window.event.stopPropagation();
        var xAxis = self.chart.xAxis[0];
        var max = xAxis.max;
        var min = xAxis.min;
        var multiplierX = (max - min) / 4;
        var minX = min + multiplierX;
        var maxX = max + multiplierX;  
        xAxis.options.startOnTick = false;
        xAxis.options.endOnTick = false;  
        minX = minX / 1000 >= parseInt(self.initialBeginTime, 10) ? minX : parseInt(self.initialBeginTime, 10) * 1000;
        maxX = maxX / 1000 <= parseInt(self.initialEndTime, 10) ? maxX : parseInt(self.initialEndTime, 10) * 1000;
        if(min / 1000 >= parseInt(self.initialBeginTime, 10) || max / 1000 <= parseInt(self.initialEndTime, 10))
        {
            self.masterChart.changePlotbands(minX, maxX);            
            self.addStateInHistory(minX / 1000, maxX / 1000); 
            self.moovingRightCount++; 
            xAxis.setExtremes(minX, maxX); 
            if(self.moovingRightCount > 3)
            {
                if(!self.stopPropagation)
                {
                    self.refreshChart(minX / 1000, maxX / 1000);
                    self.moovingRightCount = 0;
                }  
            }  
        }
    };

    me.addButtonInControls = function(text, callback)
    {
        var self = this;
        self.menuItems.push({onclick: function()
        {
            var min = self.chart.xAxis[0].min / 1000;
            var max = self.chart.xAxis[0].max / 1000;
            callback(min, max);
        }, text: text});
    };

    me.addButton = function(iconClass, callback)
    {
        var self = this;
        var button = {text: false, label: false, icons: {primary: 'ui-icon ' + iconClass},
        onclick: function()
        {            
            self.removeSelection();
            callback(self.selectedXExtremes.beginTime / 1000, self.selectedXExtremes.endTime / 1000);
        }};
        self.buttons.push(button)
    };

    me.renderButtons = function(event)
    {
        var self = this;
        var pos = self.rect.getBBox();        
        if(pos.width === 0 && pos.height === 0)
        {
            pos = {x: event.offsetX, y: event.offsetY, width: 0, height: 0};
        }       
        var containerPos = jQuery('#' + self.id).position();      
        var container = document.getElementById('moduleChart');      
        var multiplierPos;
        for(var i = 0; i < self.buttons.length; i++)
        {
            multiplierPos = i * 16; 
            var buttonContainer = document.createElement('div');       
            buttonContainer.id = 'selectionButtons' + i;
            buttonContainer.style.left = containerPos.left + pos.x + pos.width + 'px';
            buttonContainer.style.top = containerPos.top + pos.y + pos.height - multiplierPos + 'px';
            buttonContainer.style.position = 'absolute';
            container.appendChild(buttonContainer);
            jQuery('#selectionButtons' + i).button(self.buttons[i]).click(self.buttons[i].onclick);            
        }
    };

    me.deleteButtons = function()
    {
        var self = this;
        for(var i = 0; i < self.buttons.length; i++)
        {
            jQuery('#selectionButtons' + i).remove();
        }        
    };

   

    me.addStateInHistory = function(beginTime, endTime)
    {
        var self = this;
        var axesExtremes = [];        
        if(!self.isHistoryMoving)
        {
            self.historyHandler.addWindow(beginTime, endTime, axesExtremes);
        } 
    };

    me.addCallbackOnChartRefreshing = function(callback)
    {
        var self = this;
        self.callbacksOnRefreshing.push(callback);
    };

    me.addFilter = function(value)
    {
        var self = this;
        self.filters.push(value);
    };

    me.setDataInMasterChart = function(series)
    {
        var self = this;
        self.masterChart.changeSeries(series);
    }

    me.createDivs = function()
    {
        var self = this;
        var container = document.getElementById(self.containerId);
        var detailChart = document.createElement('div');
        var mooveDiv = document.createElement('div');
        var masterChart = document.createElement('div');
        var mooveAxesDiv = document.createElement('div');
        mooveAxesDiv.id = 'mooveAxesDiv';
        mooveDiv.id = 'mooveDiv';
        detailChart.id = self.id;
        detailChart.style.position = 'absolute';
        masterChart.id = self.masterChartId;
        masterChart.style.flow = 'auto';
        masterChart.style.height = '150px';
        mooveDiv.appendChild(masterChart);
        container.appendChild(mooveAxesDiv);
        mooveAxesDiv.appendChild(mooveDiv);
        mooveAxesDiv.appendChild(detailChart);        
    };

    me.initializeAggregatorsConfig = function()
    {
     jQuery.ajax(
        {
            url: me.hostURL + "/adei2/graphrenderer/aggregators/config.json",
            complete: function(data)
            {
                me.initializeAggregators(data);
            }
        });    
    };

    me.initializeAggregators = function(data)
    {
        var self = this;
        self.aggregators = JSON.parse(data.responseText);  
        self.defineAggregators();    
    };

    me.defineAggregators = function()
    {
        var self = this;
        self.aggregators.forEach(function(aggregator)
        {
            aggregator.isOn = false;
            aggregator.aggregator = new window[aggregator.className];            
            self.defineAggregatorsButtons(aggregator);            
        });
    };

    me.defineAggregatorsButtons = function(aggregator)
    {
        var self = this;
        var button = {};
        button.text = aggregator.text = aggregator.buttonText;
        button.onclick = function()
        {
            self.deactivateAggregators();
            aggregator.isOn = true;
            self.updateAxesForAggregators(aggregator);            
            self.refreshChartInCurrentExtremes();
        }
        self.menuItems.push(button);
    };

    me.updateAxesForAggregators = function(aggregator)
    {
        var self = this;
        self.chart.yAxis.forEach(function(yAxis)
        {
            var options = yAxis.userOptions;
            options.labels.format = '{value} ' + aggregator.axisUnits;
            options.title.text = aggregator.axisLabel;
            yAxis.update(options);
        });
    }

    me.refreshChartInCurrentExtremes = function()
    {
        var self = this;
        self.refreshChart(self.chart.xAxis[0].min /  1000, self.chart.xAxis[0].max / 1000);
    };

    me.toInitialView = function()
    {
        var self = this;
        self.deactivateAggregators();
        self.refreshAxes();
        self.filters = [];
        self.refreshChartInCurrentExtremes(); 
    };

    me.refreshAxes = function()
    {
        var self = this;
        for(var i = 0; i < self.axes.length; i++)
        {
            for(var j = 0; j < self.chart.yAxis.length; j++)
            {
                var yAxis = self.chart.yAxis[j];
                var axis = self.axes[i];
                if(axis.value === yAxis.userOptions.id)
                {
                    self.axesToShow[j].labels.format = '{value} ' + axis.units;
                    self.axesToShow[j].title.text = axis.name;
                    yAxis.update(self.axesToShow[j]);
                }
            }
        }
    };

    me.deactivateAggregators = function()
    {
        var self = this;
        self.aggregators.forEach(function(agg)
        {
            agg.isOn = false;
        });
    };

    me.aggregateData = function(data)
    {
        var self = this;
        for(var i = 0; i < self.aggregators.length; i++)
        {
            if(self.aggregators[i].isOn == true)
            {
                self.aggregators[i].aggregator.aggregateSeries(data);
            }
        }
    };

    me.filterData = function()
    {
        var self = this;
        for(var i = 0; i < self.chart.yAxis.length; i++)
        {
            var yAxis = self.chart.yAxis[i];
            self.addFilter([self.selectedYExtremes[i].min, self.selectedYExtremes[i].max]);
        }  
        self.refreshChartInCurrentExtremes();

    };

    me.checkFirefox = function()
    {
        var self = this;
        if(self.db.isFirefox)
        {
            alert('New version of graph is not supported by Mozilla Firefox, please download Google Chrome');        
        }
    };

    me.GetNode = function(){};
    me.attachEvent = function(){};
    me.dispatchEvent = function(event){};

    me.menuItems = [{
                        onclick: me.hideLegend.bind(me),
                        text: 'Hide legend'      
                    },
                    {
                        onclick: me.showLegend.bind(me),
                        text: 'Show legend'   
                    },
                    {
                        separator: true
                    },                
                    {
                        onclick: me.changeZoomTypeToMap.bind(me),
                        text: 'To map manipulation' 
                    },
                    {
                        onclick: me.changeZoomTypeToXY.bind(me),
                        text: 'To XY zoom type'
                    },
                    {
                        separator: true
                    },                  
                    {
                        onclick: me.renderMissingPoints.bind(me),
                        text: 'Show missing points' 
                    },
                    {
                        onclick: me.renderPointCounts.bind(me),
                        text: 'Show point count on experiment interval'
                    },
                    {
                        onclick: me.renderFirstSeries.bind(me),
                        text: 'Show first channel'
                    },
                    {
                        separator: true
                    },
                    {
                        onclick: me.toInitialView.bind(me),
                        text: 'To initial view'
                    }];

    me.buttons = [{
                    label: false,
                    text: false,
                    icons: {primary: 'ui-icon ui-icon-arrowreturnthick-1-s'},
                    onclick: me.onZoomEvent.bind(me)
                },
                {
                    label: false,
                    text: false,
                    icons: {primary: 'ui-icon-circle-minus'},
                    onclick: me.filterData.bind(me)
                }];

    me.checkFirefox();
    me.createDivs();
    me.initializeAggregatorsConfig();
    me.masterChart.setUpDetailChart(me);           

    return me;



};



