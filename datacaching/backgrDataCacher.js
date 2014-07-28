
importScripts('./dataStream.js');
importScripts('./webSockets.js');

hostURL = 'http://ipecluster5.ipe.kit.edu/ADEIRelease/adei';
//hostURL = 'http://katrin.kit.edu/~amatveev'

self.addEventListener('message', function(e)
{
    var data = e.data.split('<>');
    db_server = data[0];
    db_name = data[1];
    db_group = data[2];
    window = data[3];
    level = data[4];
    tableColumns = data[5];
    tableName = data[6];
    db_items = data[7];
    labels = data[8];
    dataLevels = data[9];
    aggregation = data[10];
    communicationType = data[11];
    readyState = 1;
    startBackgroundCaching();
});

db = openDatabase('DB', '1.0', '', 50 * 1024 * 1024);
socket = webSockets('ws://ipecluster5.ipe.kit.edu:12345');


startBackgroundCaching = function()
{
    channelCount = db_items.split(',').length;
    switch (communicationType)
    {
        case 'websockets':
            onReady();
            //socket.openSocket();
            //socket.setOnOpenCallback(onReady);
            //socket.setOnMessageCallback(onMessageRecieved);
            break;
        case 'httpgetcsv':
            onReady();
            break;
        case 'httpgetbinary':
            onReady();
            break;
    }
}
;

function onReady()
{
    db.transaction(function(req)
    {
        req.executeSql('SELECT id FROM DataSource WHERE db_server = "' + db_server + '" AND \n\
                                                   db_name = "' + db_name + '" AND \n\
                                                   db_group = "' + db_group + '" AND \n\
                                                   level = "' + level + '" AND \n\
                                                   aggregation = "' + aggregation + '" AND \n\
                                                   db_items = "' + db_items + '"', [], function(req, results)
        {
            if (results.rows.length != 0)
            {
                idDataSource = results.rows.item(0).id;
                req.executeSql('CREATE TABLE IF NOT EXISTS "' + idDataSource + '" (DateTime REAL NOT NULL UNIQUE ' + tableColumns + ')');
                req.executeSql('CREATE INDEX IF NOT EXISTS DateTimeIndex ON "' + idDataSource + '" (DateTime)');
                onReadySelectingDataSource(req);
            }
            else
            {
                req.executeSql('INSERT OR REPLACE INTO DataSource (db_server, db_name, db_group, aggregation, level, db_items, labels, datalevels) VALUES ("' + db_server + '","' + db_name + '","' + db_group + '","' + aggregation + '","' + level + '","' + db_items + '","' + labels + '","' + dataLevels + '")');
                req.executeSql('SELECT id FROM DataSource WHERE db_server = "' + db_server + '" AND \n\
                                                   db_name = "' + db_name + '" AND \n\
                                                   db_group = "' + db_group + '" AND \n\
                                                   level = "' + level + '"AND \n\
                                                   aggregation = "' + aggregation + '" AND \n\
                                                   db_items = "' + db_items + '"', [], function(req, results)
                {
                    idDataSource = results.rows.item(0).id;
                    req.executeSql('CREATE TABLE IF NOT EXISTS "' + idDataSource + '" (DateTime REAL NOT NULL UNIQUE ' + tableColumns + ')');
                    req.executeSql('CREATE INDEX IF NOT EXISTS DateTimeIndex ON "' + idDataSource + '" (DateTime)');
                    onReadySelectingDataSource(req);

                });
            }
        });


    },
            onError,
            onReadyTransaction);
}


function requestData(window)
{
    var time = formatTime(window);
    var url;
    switch (communicationType)
    {
        case 'websockets':
            socket.sendMessage(tableName + ';' + window + ';' + '1' + ';' + aggregation + ';' + channelCount + ';' + db_items + ';');
            break;
        case 'httpgetcsv':
            url = formURLGetCsv(
                    db_server,
                    db_name,
                    db_group,
                    db_items,
                    time.begTime + '-' + time.endTime,
                    level);
            httpGetCsv(url, onMessageRecievedCsv);
            break;
        case 'httpgetbinary':
            url = formURLGetBinary(
                    db_server,
                    db_name,
                    db_group,
                    db_items,
                    time.begTime + '-' + time.endTime,
                    level);
            httpGetBinary(url, onMessageRecievedBinary);
            break;
    }
}

function onMessageRecievedCsv(msg)
{
    var rows = msg.split('\r\n');
    var dateTime = [];
    var data = [];

    for (var i = 0; i < channelCount; i++)
    {
        data.push([]);
    }

    for (i = 1; i < rows.length - 1; i++)
    {
        var rowdata = rows[i].split(',');
        var time = splitTimeFromAny(rowdata[0]);
        time = (new Date(time)).getTime()/1000;
        dateTime.push(time);
        for (var j = 0; j < rowdata.length - 1; j++)
        {
            data[j].push(parseFloat(rowdata[j + 1]));
        }
    }

    onReadyFormingData({data: data, dateTime: dateTime});
}


function onMessageRecievedBinary(msg)
{
    var dataStream = new DataStream(msg);
    dataStream.readString(1);
    dataStream.endianness = dataStream.LITTLE_ENDIAN;
    var dateTime = [];
    var data = [];
    for (var i = 0; i < channelCount; i++)
    {
        data.push([]);
    }
    try
    {
        while (!dataStream.isEof())
        {
            var time = dataStream.readUint32(true);
            time = time + parseFloat('0.' + dataStream.readUint32(true));
            dateTime.push(time);
            for (i = 0; i < channelCount; i++)
            {
                data[i].push(dataStream.readFloat64(true));
            }
        }
    }
    catch (err)
    {
        console.log(err);
        console.log(String.fromCharCode.apply(null, new Uint16Array(msg.data)));
    }

    onReadyFormingData({data: data, dateTime: dateTime});
}



function onReadyWork()
{
    if(communicationType === 'websockets')
    {
        socket.closeSocket();
    }    
    console.log('Background: complete.');
    //self.close();
}


function onErrorWork(err)
{
    if(communicationType === 'websockets')
    {
        socket.closeSocket();
    }  
    console.log('Background: ' + err);
    //self.close();
}

function onReadyTransaction()
{
    //console.log('Background: transaction completed');
    //self.close();
}


function onError(err)
{
    if(communicationType === 'websockets')
    {
        socket.closeSocket();
    }  
    console.log('Background: ' + err.message);
    //self.close();
}


function onMessageRecieved(msg)
{
    socket.closeSocket();
    var dataStream = new DataStream(msg.data);
    dataStream.endianness = dataStream.BIG_ENDIAN;

    var dateTime = [];
    var data = [];
    for (var i = 0; i < channelCount; i++)
    {
        data.push([]);
    }
    while (!dataStream.isEof())
    {
        var time = dataStream.readString(29);
        dateTime.push(formatToUnix(time));
        for (var i = 0; i < channelCount; i++)
        {
            data[i].push(dataStream.readFloat64(true));
        }
    }

    onReadyFormingData({data: data, dateTime: dateTime});
}


function onReadyFormingData(objData)
{
    db.transaction(function(req)
    {
        for (var p = 0; p < objData.dateTime.length; p++)
        {
            req.executeSql('INSERT OR REPLACE INTO "' + idDataSource + '" (DateTime ' + tableColumns + ') ' + 'VALUES ' + '("' + objData.dateTime[p] + '"' + formValues(objData.data, p) + ')');
        }
    },
            onError,
            onReadyWork);
}


monthFormats = 
{
    'Jan': 0,
    'Feb': 1,
    'Mar': 2,
    'Apr': 3,
    'May': 4,
    'Jun': 5,
    'Jul': 6,
    'Aug': 7,
    'Sep': 8,
    'Oct': 9,
    'Nov': 10,
    'Dec': 11
}

function splitTimeFromAny(window)
{
    var Microsec = window.substr(19);
    //window = window.substring(0, 18);
    var year = window.substr(7, 2);
    var month = window.substr(3, 3);
    var day = window.substr(0, 2);
    var hour = window.substr(10, 2);
    var minute = window.substr(13, 2);
    var sec = window.substr(16, 2);
    if (year > 60)
    {
        year = '19' + year;
    }
    else
    {
        year = '20' + year;
    }
    var d = new Date(year, monthFormats[month], day, hour, minute, sec);
    var buf = d.toISOString().substr(13).substring(0, 7);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    var Time = d.toISOString().substring(0, 13);
    Time = Time + buf + Microsec;
    return Time;
}

function onReadySelectingDataSource(req)
{
    var beginTime = window.split('-')[0].split('.')[0];
    var endTime = window.split('-')[1].split('.')[0];
    var sqlStatement = 'SELECT DateTime FROM "' + idDataSource + '" WHERE DateTime <=  "' + endTime + '" AND DateTime >= "' + beginTime + '"  ORDER BY DateTime ';
    req.executeSql(sqlStatement, [], onReturnResult);
}


function onReturnResult(req, results)
{
    if (results.rows.length !== 0)
    {
        var beginTime = parseFloat(formatUnixTime(window.split('-')[0], level));// + 2 * level;
        var endTime = parseFloat(formatUnixTime(window.split('-')[1], level));// - 2 * level;

        var returnedBeginTime = parseFloat(results.rows.item(0).DateTime);
        var returnedEndTime = parseFloat(results.rows.item(results.rows.length - 1).DateTime);
        var needenTime;
        //console.log(tableName + ';' + '1' + ';' + aggregation + ';' + channelCount + ';' + db_items);

        if (beginTime === returnedBeginTime && endTime === returnedEndTime)
        {
            //console.log('Background: exist - ' + level);
            //self.close();
            return;
        }
        if (returnedBeginTime > beginTime && returnedEndTime === endTime)
        {
            //console.log('Background: left - ' + level);
            needenTime = beginTime + '-' + returnedBeginTime;
            request(needenTime);
            return;
        }
        if (returnedBeginTime === beginTime && returnedEndTime < endTime)
        {
            //console.log('Background: right - ' + level);
            needenTime = returnedEndTime + '-' + endTime;
            request(needenTime);
            return;
        }
        if (beginTime < returnedBeginTime && endTime > returnedEndTime)
        {
            //console.log('Background: everithing - ' + level);
            needenTime = beginTime + '-' + endTime;
            request(needenTime);
            return;
        }
        if (communicationType === 'websockets')
        {
            //socket.closeSocket();
        }
        //requestData(beginTime + '-' + endTime);
    }
    else
    {
        //console.log('Background: nothing' + level);
        request(window);
    }
}


function formatUnixTime(time, aggregator)
{
    if (aggregator !== 0)
    {
        var multiplier = time / aggregator;
        multiplier = parseInt(multiplier, 10);
        multiplier = multiplier * aggregator;
        return multiplier;
    }
    else
    {
        return time;
    }

}


function request(needenTime)
{
    var time = needenTime;
    if (communicationType === 'websockets')
    {
        socket.openSocket();
        socket.setOnOpenCallback(function()
        {
            requestData(time);
        });
        socket.setOnMessageCallback(onMessageRecieved);
    }
    else
    {
        requestData(time);
    }
}


function formValues(data, i)
{
    var values = '';
    var points = [];
    for (var j = 0; j < data.length; j++)
    {
        //values = values + ',' + data[j][i];
        points.push(data[j][i]);
    }
    return ', "' + JSON.stringify(points) + '"';
}


function formatToUnix(time)
{
    var date = time.split('.')[0];
    var milisec = time.split('.')[1];
    var unix = (Date.parse(date) / 1000) + '.' + milisec;
    return unix;
}



function httpGetCsv(url, callback)
{
    var xmlHttp = null;

    xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function()
    {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
        {
            callback(xmlHttp.responseText);
        }
    };
    xmlHttp.open("GET", url, true);
    xmlHttp.send(null);
}


function httpGetBinary(url, callback)
{
    var xmlHttp = null;

    xmlHttp = new XMLHttpRequest();
    xmlHttp.onload = function()
    {
        callback(xmlHttp.response);
    };
    xmlHttp.open("GET", url, true);
    xmlHttp.responseType = "arraybuffer";
    xmlHttp.send(null);
}


function formatTime(window)
{
    var beginTime = window.split('-')[0];
    var endTime = window.split('-')[1];
    if (beginTime.indexOf('.') - 1)
    {
        beginTime = beginTime.split('.')[0];
    }
    if (endTime.indexOf('.') - 1)
    {
        endTime = endTime.split('.')[0];
    }
    return {begTime: beginTime, endTime: endTime};
}


function formURLGetCsv(db_server, db_name, db_group, db_mask, window, level)
{
    var url = hostURL + '/services/getdata.php?db_server=' + db_server
            + '&db_name=' + db_name
            + '&db_group=' + db_group
            + '&db_mask=' + db_mask
            + '&experiment=' + window
            + '&window=0'
            + '&resample=' + level
            + '&format=csv';
    return url;
}


function formURLGetBinary(db_server, db_name, db_group, db_mask, window, level)
{
    var url = hostURL + '/services/getdata.php?db_server=' + db_server
            + '&db_name=' + db_name
            + '&db_group=' + db_group
            + '&db_mask=' + db_mask
            + '&experiment=' + window
            + '&window=0'
            + '&resample=' + level
            + '&format=graphrenderer';
    return url;
}



