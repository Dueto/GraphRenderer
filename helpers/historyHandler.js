var historyHandler = function()
{
	var me = {};

	me.currentWindow = -1;

	me.history = [];

	me.addWindow = function(beginTime, endTime)
	{
		var self = this;	
		self.currentWindow++;	 
		if(self.currentWindow === self.history.length)
		{			
			self.history.push({beginTime: beginTime, endTime: endTime});
			window.history.pushState({beginTime: beginTime, endTime: endTime});						
		}
		else
		{		
			var historyToDelete = self.history.length - self.currentWindow;
			self.history.splice(self.currentWindow, historyToDelete);
			self.history.push({beginTime: beginTime, endTime: endTime});	
			window.history.pushState({beginTime: beginTime, endTime: endTime});
		}
		if(self.history.length > 30)
		{
			self.history.splice(0, 1);
			self.currentWindow = self.history.length;
		}	
	};

	me.getCurrentWindow = function()
	{
		var self = this;
		return self.history[self.currentWindow];
	};

	me.getNextWindow = function()
	{
		var self = this;
		if(self.currentWindow + 1 <= self.history.length)
		{
			self.currentWindow++;
			return self.history[self.currentWindow];
		}
		else
		{
			return null;
		}
	};

	me.getPrevWindow = function()
	{
		var self = this;
		if(self.currentWindow - 1 >= 0)
		{
			self.currentWindow--;
			return self.history[self.currentWindow];
		}
		else
		{
			return null;
		}
	};

	return me;


};