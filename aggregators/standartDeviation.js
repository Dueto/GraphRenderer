
// AGGREGATORS should be in window namespace
// It should have method aggregateSeries(), which is getting data in format:  
//array [
//        array [time0, value0],
//        array [time1, value1],
//        ,
//        ,
//        ,
//        array [timeN, valueN] 
//       ]
// Then it should recalculate values in arrays.

var standartDeviationAggregator = function()
{
	"use strict";

	var me = {};

	me.aggregateSeries = function(data)
	{
		var mean = 0;
		for(var i = 0; i < data.length; i++)
		{
			mean = mean + data[i][1];
		}
		mean = mean / data.length;
		var sum = 0;
		for(var i = 0; i < data.length; i++)
		{
			sum = sum + Math.pow((data[i][1] - mean), 2);
		}
		var stDev = Math.sqrt(sum / data.length);
		for(var i = 0; i < data.length; i++)
		{
			data[i][1] = data[i][1] - stDev;
		}
	};

	return me;
};