var masterChartRenderer = function()
{
    "use strict";

    var me = {};

    me.id = '';
    me.zoomCallback = '';
    me.chart = null;
    me.series = [];
    me.seriesData = [];
    me.optimalSeries = [];
    me.seriesNumber = 0;
    me.dragData = null;
    me.previousStateX = null;
    me.divWidth = null;
    me.dragBordersWidth = 15;
    me.dragLeftBorder = false;
    me.dragRightBorder = false;
    me.detailChart = null;

    me.beginTime = null;
    me.endTime = null;

    me.title = null;

    me.leftControl = null;
    me.rightControl = null;

    me.isZoomed = null;
    me.onlyDragging = false;
    me.intervalVariable = null;

    me.prevbegTime = null;
    me.orevEndTime = null;

    me.isOptimalView = false;

    me.controlsVisibility = 'none';

    me.seriesMissingPoints = null;
    me.seriesPointCount = null;

    me.renderMasterChar = function(id, series, seriesNumber)
    {
        var self = this;      
        self.id = id;
        var ser = {};
        ser.data = [];           
        self.seriesNumber = seriesNumber;     
        for (var i = 0; i < series.data.length; i++)
        {
            ser.data.push(series.data[i].slice(0));
        }
        self.beginTime = ser.data[0][0];
        self.endTime = ser.data[ser.data.length - 1][0];
        ser.name = series.name;
        ser.pointInterval = series.pointInterval;
        self.series.push(ser);
        self.seriesData = ser;

        jQuery('#' + id).highcharts(
                {
                    chart:
                            {
                                reflow: false,
                                borderWidth: 0,
                                backgroundColor: null,
                                marginLeft: 40,
                                marginRight: 40,
                                zoomType: 'x',
                                events:
                                        {
                                            selection: function(event)
                                            {
                                                var extremesObject = event.xAxis[0],
                                                        min = extremesObject.min,
                                                        max = extremesObject.max,
                                                        xAxis = this.xAxis[0];
                                                self.changePlotbands(min, max);
                                                self.detailChart.moovingRightCount = 4;
                                                self.detailChart.moovingLeftCount = 4;
                                                self.zoomCallback(event);
                                                return false;
                                                /*xAxis.removePlotBand('mask-before');
                                                xAxis.addPlotBand({
                                                    id: 'mask-before',
                                                    from: self.series[0].data[0][0],
                                                    to: min,
                                                    color: 'rgba(0, 0, 0, 0.2)'
                                                });

                                                xAxis.removePlotBand('mask-after');
                                                xAxis.addPlotBand({
                                                    id: 'mask-after',
                                                    from: max,
                                                    to: self.series[0].data[series.data.length - 1][0],
                                                    color: 'rgba(0, 0, 0, 0.2)'
                                                });
                                                var plotBeginTime = self.chart.xAxis[0].min;
                                                var plotEndTime = self.chart.xAxis[0].max;
                                                var bandBeginTime = min;
                                                var bandEndTime = max;
                                                var plotDiff = (plotEndTime - plotBeginTime) / self.divWidth;
                                                var bandDiff = (bandEndTime - bandBeginTime) / self.divWidth;
                                                if((plotDiff / bandDiff) > 200)
                                                {
                                                    xAxis.removePlotLine('plotline');                                                   
                                                    xAxis.addPlotLine({
                                                        color: 'red',
                                                        width: 8,
                                                        id: 'plotline',
                                                        value: bandBeginTime
                                                    });
                                                    self.onlyDragging = true;
                                                }
                                                else 
                                                {
                                                    xAxis.removePlotLine('plotline');                                                
                                                    self.onlyDragging = false;
                                                }
                                                self.detailChart.moovingRightCount = 4;
                                                self.detailChart.moovingLeftCount = 4;
                                                self.zoomCallback(event);
                                                return false;*/
                                            }
                                        }

                            },
                    title:
                            {
                                text: self.title
                            },
                    credits:
                            {
                                enabled: false
                            },
                    yAxis:
                            {
                                gridLineWidth: 0,
                                labels:
                                        {
                                            enabled: true
                                        },
                                title:
                                        {
                                            text: null
                                        },
                                showFirstLabel: true,
                                tickPixelInterval: 12,
                                opposite: true
                            },
                    xAxis:
                            {
                                type: 'datetime'
                            },
                    tooltip:
                            { 
                                formatter: function()
                                {
                                    return false;
                                }
                            },
                    legend:
                            {
                                enabled: false
                            },
                    plotOptions:
                            {
                                series:
                                        {
                                            fillColor:
                                                    {
                                                        linearGradient: [0, 0, 0, 70],
                                                        stops: [
                                                            [0, '#4572A7'],
                                                            [1, 'rgba(0,0,0,0)']
                                                        ]
                                                    },
                                            lineWidth: 1,
                                            marker:
                                                    {
                                                        enabled: false
                                                    },
                                            shadow: false,
                                            states:
                                                    {
                                                        hover:
                                                                {
                                                                    lineWidth: 1
                                                                }
                                                    },
                                            enableMouseTracking: false
                                        }
                            },
                    series: [series],
                    exporting: 
                    {
                        buttons: 
                        {                    
                            menu: 
                            {
                                x: -70,
                                //symbol: 'circle',
                                onclick: self.toOptimalZoom.bind(self),
                                text: 'To full/optimal view',
                                theme: 
                                {
                                    zIndex: 20
                                }  
                            }
                        }
                    }
                });
        this.chart = jQuery('#' + id).highcharts();
        self.recalculateDivSizes();
        self.buildControls();
    };

    me.toOptimalZoom = function()
    {
        var self = this;
        var plotBandBefore = self.chart.xAxis[0].plotLinesAndBands[0];
        var plotBandAfter = self.chart.xAxis[0].plotLinesAndBands[1];  
        var beginTime = plotBandBefore.options.to;
        var endTime = plotBandAfter.options.from; 
        if(self.isOptimalView)
        {
            self.isOptimalView = false;
            self.controlsVisibility = 'none';
            self.leftControl.style.display = self.controlsVisibility;   
            self.rightControl.style.display = self.controlsVisibility;                   
            self.chart.xAxis[0].setExtremes(self.beginTime, self.endTime);   
            self.changePlotbands(beginTime, endTime);
        }
        else
        {
            self.isOptimalView = true;
            self.controlsVisibility = '';
            self.leftControl.style.display = self.controlsVisibility;   
            self.rightControl.style.display = self.controlsVisibility;                     
            var diffrence = (endTime - beginTime) * 2;
            var newOptZoomBeg = ((beginTime - diffrence) < self.beginTime) ? self.beginTime : beginTime - diffrence;
            var newOptZoomEnd = ((endTime + diffrence) > self.endTime) ? self.endTime : endTime + diffrence;       
            self.chart.xAxis[0].setExtremes(newOptZoomBeg, newOptZoomEnd);
            self.changePlotbands(beginTime, endTime); 
        }    
    };

    me.setTitle = function(dataSourceTitle)
    {
        var self = this;
        var min = self.detailChart.chart.xAxis[0].min;
        var max = self.detailChart.chart.xAxis[0].max;
        var dateTimeInterval = self.formDateIntervals(min, max);

        self.chart.setTitle({ text: dateTimeInterval + ' ' + dataSourceTitle + ', aggregation: ' + self.detailChart.dataSources[0].aggregation});
    };


    me.formDateIntervals = function(min, max)
    {
        var diff = max - min;
        /*var dateMin = new Date(min * 1000);
        var dateMax = new Date(max * 1000);
        var yearMin = dateMin.getYear();
        var monthMin = dateMin.getMonth();
        var dayMin = dateMin.getDay();
        var hourMin = dateMin.getHours();
        var yearMax = dateMax.getYear();
        var monthMax = dateMax.getMonth();
        var dayMax = dateMax.getDay();
        var hourMax = dateMax.getHours();*/
        if(diff > 32000000000)
        {
            return Highcharts.dateFormat('%Y', min) + ' - ' + Highcharts.dateFormat('%Y', max);
        }
        else if(diff > 2600000000)
        {
            return Highcharts.dateFormat('%Y %b', min) + ' - ' + Highcharts.dateFormat('%Y %b', max);
        }
        else if(diff > 86400000)
        {
            return Highcharts.dateFormat('%Y %b %e', min) + ' - ' + Highcharts.dateFormat('%Y %b %e', max);
        }
        else(diff > 3600000)
        {
            return Highcharts.dateFormat('%Y %b %e, %H:%M', min) + ' - ' + Highcharts.dateFormat('%Y %b %e, %H:%M', max);
        }        
    };

    me.buildControls = function(width)
    {
        var self = this;
        var chart = document.getElementsByClassName("highcharts-series-group")[0].getBBox();      
        var pos = jQuery('#' + self.id).position();
        var parent = document.getElementById('mooveDiv');  
        self.leftControl = document.createElement('div');
        self.leftControl.className = 'chronoline-left';  
        self.leftControl.style.display = self.controlsVisibility;  

        var leftIcon = document.createElement('div');
        leftIcon.className = 'chronoline-left-icon';
        leftIcon.style.marginTop = '12px';
        leftIcon.style.marginLeft= '4px';
        self.leftControl.appendChild(leftIcon);
        self.leftControl.style.display = true;
        self.leftControl.style.marginTop = 10;
        self.leftControl.style.left = pos.left + 12 +'px';
        self.leftControl.style.top = pos.top + 25 + 'px';
        self.leftControl.style.marginTop = '40px';
        self.leftControl.style.height = '40px';
        self.leftControl.onmousedown = self.dragLeftSide.bind(self);        
        self.leftControl.onmouseup = self.onControlMouseUp.bind(self);
        self.leftControl.onmouseout = self.onControlMouseUp.bind(self);
        parent.appendChild(self.leftControl);

        self.rightControl = document.createElement('div');
        self.rightControl.className = 'chronoline-right'; 
        self.rightControl.style.display = self.controlsVisibility; 

        var rightIcon = document.createElement('div');
        rightIcon.className = 'chronoline-right-icon';                
        rightIcon.style.marginTop = '12px';
        rightIcon.style.marginLeft= '6px';
        self.rightControl.appendChild(rightIcon);
        self.rightControl.style.display = true;
        self.rightControl.style.marginTop = 10;  
        if(typeof width !== 'undefined')  
        {self.rightControl.style.left = pos.left + width - 38 + 'px';}
        else
        {self.rightControl.style.left = pos.left + chart.width + 70 + 'px';}           
        self.rightControl.style.top = pos.top + 25 +'px';
        self.rightControl.style.marginTop = '40px';
        self.rightControl.style.height = '40px';
        self.rightControl.onmousedown = self.dragRightSide.bind(self);
        self.rightControl.onmouseup = self.onControlMouseUp.bind(self);
        self.rightControl.onmouseout = self.onControlMouseUp.bind(self);
        parent.appendChild(self.rightControl);
            
    };

    me.dragRightSide = function()
    {
        var self = this; 
        self.intervalVariable = setInterval(function()
            {
                var multiplier = (self.detailChart.chart.xAxis[0].max - self.detailChart.chart.xAxis[0].min) / self.detailChart.divWidth;                     
                var btime = self.detailChart.chart.xAxis[0].min + multiplier * 40;
                var etime = self.detailChart.chart.xAxis[0].max + multiplier * 40;       
                var extrBeginTime = self.chart.xAxis[0].min + multiplier * 40;        
                var extrEndTime = self.chart.xAxis[0].max + multiplier * 40;  
                if(self.endTime >= extrEndTime)
                {
                    self.changePlotbands(btime, etime);    
                    self.chart.xAxis[0].setExtremes(extrBeginTime, extrEndTime, true, false);            
                    self.detailChart.zoomChart(btime / 1000, etime / 1000, false);       
                }                
            }, 10);

    };

    me.dragLeftSide = function()
    {
        var self = this; 
        self.intervalVariable = setInterval(function()
            {
                var multiplier = (self.detailChart.chart.xAxis[0].max - self.detailChart.chart.xAxis[0].min) / self.detailChart.divWidth;                     
                var btime = self.detailChart.chart.xAxis[0].min - multiplier * 40;
                var etime = self.detailChart.chart.xAxis[0].max - multiplier * 40; 
                var extrBeginTime = self.chart.xAxis[0].min - multiplier * 40;        
                var extrEndTime = self.chart.xAxis[0].max - multiplier * 40;
                if(self.beginTime <= extrBeginTime)
                {
                    self.changePlotbands(btime, etime);                
                    self.chart.xAxis[0].setExtremes(extrBeginTime, extrEndTime, true, false);                        
                    self.detailChart.zoomChart(btime / 1000, etime / 1000, false);                        
                }                                  
                         
            }, 10);

    };

    me.setOnZoomCallback = function(zoomCallback)
    {
        this.zoomCallback = zoomCallback;
    };

    me.startDrag = function(event)
    {
	var self = this;
	if(self.chart !== null)
	{
    	var x = event.offsetX; 
        var plotBandBefore;
        var plotBandAfter;
        var begTime;      
        var endTime;        
        if(self.onlyDragging)
        {
            plotBandBefore = self.chart.xAxis[0].plotLinesAndBands[2];            
            plotBandAfter = self.chart.xAxis[0].plotLinesAndBands[2];
            begTime = plotBandBefore.options.value;
            endTime = plotBandAfter.options.value; 
        }
        else
        {
            plotBandBefore = self.chart.xAxis[0].plotLinesAndBands[0];
            plotBandAfter = self.chart.xAxis[0].plotLinesAndBands[1];
            begTime = plotBandBefore.options.to;
            endTime = plotBandAfter.options.from; 
        }            
        var startPoint;
        var endPoint;   
        if(typeof plotBandBefore.svgElem !== 'undefined' && typeof plotBandAfter.svgElem !== 'undefined')
        {
            startPoint = plotBandBefore.svgElem.element.getBBox().x + plotBandBefore.svgElem.element.getBBox().width;
            endPoint = plotBandAfter.svgElem.element.getBBox().x;          
            if(self.onlyDragging) 
            {   
                if((endPoint - self.dragBordersWidth) <= x && (endPoint + self.dragBordersWidth) >= x)
                {
                    var btime = self.detailChart.chart.xAxis[0].min;
                    var etime = self.detailChart.chart.xAxis[0].max;
                    self.dragData =
                    {
                        x: event.offsetX,
                        y: event.offsetY,
                        begTime: btime,
                        endTime: etime
                    };  
                    self.dragRightBorder = false;
                    self.dragLeftBorder = false;                 
                    event.stopPropagation();
                    return;
                }  
                else
                {
                    self.dragData = null;
                    self.dragRightBorder = false;
                    self.dragLeftBorder = false;                 
                    return;
                }          
            } 
            if(startPoint + self.dragBordersWidth <= x && endPoint - self.dragBordersWidth >= x)
            {
                document.body.style.cursor = "move";               
                self.dragRightBorder = false;
                self.dragLeftBorder = false;  
            } 
            else if(endPoint - self.dragBordersWidth <= x && endPoint + self.dragBordersWidth >= x)
            {
                document.body.style.cursor = "col-resize";               
                self.dragRightBorder = true;
                self.dragLeftBorder = false; 
            }
            else if(startPoint - self.dragBordersWidth <= x && startPoint + self.dragBordersWidth >= x)
            {
                document.body.style.cursor = "col-resize";                 
                self.dragRightBorder = false;
                self.dragLeftBorder = true;  
            }
            else
            {     
                document.body.style.cursor = "default"; 
                self.dragData = null;
                self.dragRightBorder = false;
                self.dragLeftBorder = false; 
                return;            
            }
            self.dragData =
            {
                x: event.offsetX,
                y: event.offsetY,
                begTime: begTime,
                endTime: endTime
            }; 
            event.stopPropagation();
        }       
	}

    };


    me.setUpDetailChart = function(detailChart)
    {
        var self = this;
        self.detailChart = detailChart;
    };

    me.drag = function(event)
    {
        var self = this;
        if(self.dragData)
        {   
            var e = event || window.event;      
            if (self.previousStateX === null)
            {
                self.previousStateX = e.clientX;                
            }
            var mapDiffX = e.clientX - self.previousStateX;
            var begTime = self.dragData.begTime;
            var endTime = self.dragData.endTime;
            var multiplier = (self.chart.xAxis[0].max - self.chart.xAxis[0].min) / self.chart.chartWidth;              
            var btime = begTime + mapDiffX * multiplier;
            var etime = endTime + mapDiffX * multiplier;
            if(self.dragLeftBorder)
            {
                if(btime < (endTime - multiplier * 30))
                {
                    self.changePlotbands(btime, endTime);
                    self.detailChart.zoomChart(btime / 1000, endTime / 1000, false);
                }               
            } 
            else if(self.dragRightBorder)
            {
                if((begTime + multiplier * 30) < etime)
                {
                    self.changePlotbands(begTime, etime);
                    self.detailChart.zoomChart(begTime / 1000, etime / 1000, false);
                }                
            }
            else
            {   
                self.chart.xAxis[0].removePlotBand('plotline');             
                self.changePlotbands(btime, etime); 
                etime = etime > self.endTime ? self.endTime : etime;
                btime = btime < self.beginTime ? self.beginTime : btime;               
                self.detailChart.zoomChart(btime / 1000, etime / 1000, false);
            } 
            document.body.style.cursor = "move";           
            event.stopPropagation();
          
        }
        else
        {
            if(self.chart !== null)
            {                          
                var x = event.offsetX;
                var plotBandBefore = self.chart.xAxis[0].plotLinesAndBands[0];
                var plotBandAfter = self.chart.xAxis[0].plotLinesAndBands[1];  
                if(typeof plotBandAfter.svgElem !== 'undefined' && typeof plotBandBefore.svgElem !== 'undefined')
                {
                    var startPoint = plotBandBefore.svgElem.element.getBBox().x +
                                     plotBandBefore.svgElem.element.getBBox().width;
                    var endPoint = plotBandAfter.svgElem.element.getBBox().x;  
                    if(startPoint + self.dragBordersWidth <= x && 
                        endPoint - self.dragBordersWidth >= x)
                    {
                        document.body.style.cursor = "move";                   
                    } 
                    else if(endPoint - self.dragBordersWidth <= x && 
                            endPoint + self.dragBordersWidth >= x)
                    {
                        document.body.style.cursor = "col-resize"; 
                    }
                    else if(startPoint - self.dragBordersWidth <= x && 
                            startPoint + self.dragBordersWidth >= x)
                    {
                        document.body.style.cursor = "col-resize";     
                    }
                    else
                    {     
                        document.body.style.cursor = "default";   
                    }
                } 
            }
        }

    };

    me.stopDrag = function()
    {     
        var self = this;           
        if (self.dragData)
        { 
            var btime = self.detailChart.chart.xAxis[0].min / 1000;
            var etime = self.detailChart.chart.xAxis[0].max / 1000;   
            if(!self.detailChart.stopPropagation)         
            {
                self.detailChart.refreshChart(btime, etime);
            }   
            self.dragData = null;
            self.dragLeftBorder = false;
            self.dragRightBorder = false;
            self.previousStateX = null;
            document.body.style.cursor = "default";                      
        }       
    };

    me.onMouseOut = function()
    {       
        document.body.style.cursor = "default";
    };

    me.onControlMouseUp = function()
    {
        var self = this;        
        window.clearInterval(self.intervalVariable); 
        var btime = self.detailChart.chart.xAxis[0].min / 1000;
        var etime = self.detailChart.chart.xAxis[0].max / 1000; 
        if(!self.detailChart.stopPropagation)         
        {           
            self.detailChart.refreshChart(btime, etime); 
        }
    };

    me.bindEvents = function()
    {
        var self = this;
        var mooveContainer = document.getElementById('mooveDiv');
        mooveContainer.addEventListener('mousedown', self.startDrag.bind(self), true);
        mooveContainer.addEventListener('mousemove', self.drag.bind(self), true);
        mooveContainer.addEventListener('mouseup', self.stopDrag.bind(self), true);
        mooveContainer.addEventListener('mouseout', self.onMouseOut, true);       
    };

    me.changeSeries = function(series)
    {
        this.series = [];
        this.series.push(series);
        this.chart.series[0].remove();
        this.chart.addSeries(series);
    };

    me.changePlotbands = function(beginTime, endTime)
    {
        var self = this;
        var xAxis = self.chart.xAxis[0];
        beginTime = beginTime < self.beginTime ? self.beginTime + 1 : beginTime;
        endTime = endTime > self.endTime ? self.endTime - 1 : endTime;
        xAxis.removePlotBand('mask-before');
        xAxis.addPlotBand({
            id: 'mask-before',
            from: self.series[0].data[0][0],
            to: beginTime,
            color: 'rgba(0, 0, 0, 0.2)'
        });

        xAxis.removePlotBand('mask-after');
        xAxis.addPlotBand({
            id: 'mask-after',
            from: endTime,
            to: self.series[0].data[self.series[0].data.length - 1][0],
            color: 'rgba(0, 0, 0, 0.2)'
        });
        var plotBeginTime = self.chart.xAxis[0].min;
        var plotEndTime = self.chart.xAxis[0].max;
        var bandBeginTime = beginTime;
        var bandEndTime = endTime;
        var plotDiff = (plotEndTime - plotBeginTime) / self.divWidth;
        var bandDiff = (bandEndTime - bandBeginTime) / self.divWidth;
        if((plotDiff / bandDiff) > 200)
        {            
            xAxis.removePlotLine('plotline'); 
            xAxis.addPlotLine({
                color: 'red',
                width: 8,
                id: 'plotline',
                value: bandBeginTime
            });
            self.onlyDragging = true;
        }
        else 
        {           
            xAxis.removePlotLine('plotline');
            self.onlyDragging = false;
        }

    };

    me.addSeries = function(series)
    {
        this.series.push(series);
        this.chart.addSeries(series, true);
    };

    me.dispose = function()
    {
        var self = this;
        self.series = [];
        self.chart.destroy();
    };

    me.rebuildControls = function(width)
    {
        var self = this;        
        jQuery('.chronoline-left-icon').remove();
        jQuery('.chronoline-right-icon').remove();
        jQuery('.chronoline-left').remove();
        jQuery('.chronoline-right').remove();
        self.buildControls(width);  
        self.detailChart.buildControls();     
    };

    me.addButton = function(buttonName, x, y, callback)
    {
        var self = this;        
        self.chart.renderer.button(buttonName, x, y, function()
        {
            var min = self.chart.xAxis[0].min / 1000;
            var max = self.chart.xAxis[0].max / 1000;
            callback(min, max);
        }, 
        { 
            zIndex: 20
        })
        .add();
    };

    me.recalculateDivSizes = function()
    {
        var self = this;
        self.divWidth = document.getElementsByClassName('highcharts-series-group')[1].getBBox().width;
    };

    me.setSeriesMissingPoints = function(series)
    {
        var self = this; 
        self.seriesMissingPoints = series;
    };

    me.setSeriesPointCount = function(series)
    {
        var self = this; 
        self.seriesPointCount = series;
    };

    me.renderMissingPoints = function()
    {
        var self = this;
        self.seriesMissingPoints.color = "#f15c80";
        self.changeSeries(self.seriesMissingPoints);
    };

    me.renderPointCounts = function()
    {
        var self = this;
        self.seriesPointCount.color = "#90ed7d";
        self.changeSeries(self.seriesPointCount);
    };

    me.renderData = function()
    {
        var self = this; 
        self.seriesData.color = "#7cb5ec";       
        self.changeSeries(self.seriesData);
    };

    return me;



};
