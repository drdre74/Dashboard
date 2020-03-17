

//------------------------------------------------------------------
//
//------------------------------------------------------------------
function load(cb)	{

	var f = '['+(fc++)+'] '+arguments.callee.toString().replace(/function\s+/,'').split('(')[0],
			dbg=0, fEnd=function(){ dbg&&console.timeEnd(f); console.groupEnd(f); if (typeof cb=='function') cb() };
	if (dbg){ console.group(f); console.time(f) };


	loadCache(fEnd);

}




//------------------------------------------------------------------
//
//------------------------------------------------------------------
function loadCache(cb)	{

	var f = '['+(fc++)+'] '+arguments.callee.toString().replace(/function\s+/,'').split('(')[0],
	dbg=0, fEnd=function(){ dbg&&console.timeEnd(f); console.groupEnd(f); if (typeof cb=='function') cb() };
	if (dbg){ console.group(f); console.time(f) };



	loadSummary();
	loadArchive();

	loadJHU('hot', 'jhu');
	loadJHU('cold', 'jhuarchive');

	loadMartine('hot','martine');
	loadGeneric('hot', 'bnoregion');
	loadGeneric('hot', 'bnoplace');
//	loadGeneric('hot', 'casetracking');

	loadCK('hot', 'cryptokass');
	loadBNOEvents('hot','bnoevents');

	loadMalaysia('hot','malaysia');

	loadCheck(fEnd);


	window.setInterval(loadSummary, 60 * 10 * 1000);

}


//------------------------------------------------------------------
//
//------------------------------------------------------------------
function loadCheck(cb)	{

	var f = '['+(fc++)+'] '+arguments.callee.toString().replace(/function\s+/,'').split('(')[0],
	dbg=0, fEnd=function(){ dbg&&console.timeEnd(f); console.groupEnd(f); if (typeof cb=='function') cb() };
	if (dbg){ console.group(f); console.time(f) };

	if (
		M.data['first41']
		&& M.data['martine']
		&& M.data['bnoregion']
//		&& M.data['bnoplace']

		&& M.data['cryptokass']
		&& M.data['bnoevents']

//		&& M.data['bnoplace']
//		&& M.data['casetracking']
		&& M.data['jhu']
		&& M.data['jhuarchive']

		&& M.data['malaysia']
	){

		prep(function(){

			vizTimeline('daily', M.nest.daily);
			map(fEnd);

		});

	}

}

//------------------------------------------------------------------
//
//------------------------------------------------------------------
function prep(cb)	{

	var f = '['+(fc++)+'] '+arguments.callee.toString().replace(/function\s+/,'').split('(')[0],
	dbg=0, fEnd=function(){ dbg&&console.timeEnd(f); console.groupEnd(f); if (typeof cb=='function') cb() };
	if (dbg){ console.group(f); console.time(f) };



	var todate = moment().format('YYYY-MM-DD');

	//-----------------------------
	// populate current date with last available date
	//-----------------------------
	var sets = ['jhu','malaysia'];
	sets.forEach(set=>{

		var dates = d3.extent(M.data[set],d=>d.date_str);
		dbg&&console.log('dates', dates);

		if (dates[1] < todate)	{
			var lastDates = M.data[set].filter(k=>k.date_str==dates[1]);
			d3.timeDays(moment(dates[1]).add(1,'days'), moment(todate).add(1,'days')).forEach(k=>{
				lastDates.forEach(d=>{
					var j = {...d};
					j.date = +k;
					j.date_str = moment(k).format('YYYY-MM-DD');
					M.data[set].push(j);
				});
			});

		}

	});


	//-----------------------------
	// replace with malaysia data
	//-----------------------------
	var sets=['jhu'];
	sets.forEach(k=>{
		M.data[k] = M.data[k].filter(d=>d.country!='Malaysia');
	});

	M.data.malaysia.forEach(d=>{
		if (d.date_str <= todate)	{
			sets.forEach(k=>{
				var j = {...d};
				j._source=k;
				M.data[k].push(j);
			});
		}
	});



	//-----------------------------
	// first41
	//-----------------------------

	var all=[];


	if (M.data.first41)	{

		var k = M.data.jhu.find(d=>d.region.match(/hubei/i));

		all = all.concat(M.data.first41);
		all.forEach(d=>{
			d.region = 'Hubei';
			d.country = 'Mainland China';
			d.latitude = k.latitude;
			d.longitude = k.longitude;
			d._source = 'first41';
		});

		all.sort(d3.comparator().order(d3.ascending,d=>d.date));

	}


	//-----------------------------
	// include in daily calculations
	//-----------------------------


	all = all.concat(M.data['martine']);
//	all = all.concat(M.data['bnoregion']);
//	all = all.concat(M.data['bnoplace']);
//	all = all.concat(M.data['casetracking']);
	all = all.concat(M.data['jhu']);
	all = all.concat(M.data['jhuarchive']);


	//-----------------------------
	//
	//-----------------------------

	all.sort(d3.comparator().order(d3.ascending,d=>d.date));

	dbg&&console.log('all',[...all]);
	//dbg&&console.log('nest', d3.nest().key(d=>d.date_str).entries(all) );

	M.data.all = all;

	prepAll(fEnd);

}





//------------------------------------------------------------------
//
//------------------------------------------------------------------
function prepAll(cb)	{

	var f = '['+(fc++)+'] '+arguments.callee.toString().replace(/function\s+/,'').split('(')[0],
	dbg=0, fEnd=function(){ dbg&&console.timeEnd(f); console.groupEnd(f); if (typeof cb=='function') cb() };
	if (dbg){ console.group(f); console.time(f) };


	dbg&&console.log('_source', d3.nest().key(d=>d._source).entries(M.data.all));

	M.nest.daily = d3.nest()
								.key(d=>d.date_str)
								.key(d=>d._source)
								.entries(M.data.all);

	var prev = {};

	M.nest.daily.forEach(d=>{

		d.date = +moment(d.key);
		d.date_str = d.key;

		d.values.forEach(k=>{

			k.valuesFiltered = k.values.filter(d=>!!d.country);

			k.confirmed = d3.sum(k.values, d=>d.confirmed);
			k.deaths 		= d3.sum(k.values, d=>d.deaths);
			k.recovered = d3.sum(k.values, d=>d.recovered);

			k.countries	= d3.nest()
											.key(k=>k.country.replace(/Mainland China/i,'China')
												.replace(/United Arab Emirates/i,'UAE')
												.replace(/United States of America/i,'USA')
												.replace(/\bUS\b/i,'USA')
												.replace(/\bOthers\b/i,'Japan')
												.replace(/\bUnited Kingdom\b/i,'UK')
												.replace(/\btaiwan\b/i,'China')
												.replace(/\bmacau\b/i,'China')
												.replace(/\bhong.*?kong\b/i,'China')
											)
											.entries(k.values);

			k.countries.forEach(k=>{
				k.confirmed = d3.sum(k.values, d=>d.confirmed);
				k.deaths 		= d3.sum(k.values, d=>d.deaths);
				k.recovered = d3.sum(k.values, d=>d.recovered);
			});
		});


		//-----------------------------
		// custom filter
		//-----------------------------
		var filteredData = d.values;

		if (d.key>'2020-02-10')	{
			filteredData = filteredData.filter(d=>d.key.match(/first41|jhu|bno|martine/i));
		}

		d.confirmed = d3.max([prev.confirmed||0, 	d3.max(filteredData, d=>d.confirmed) ]);
		d.deaths 		= d3.max([prev.deaths||0, 		d3.max(filteredData, d=>d.deaths) ]);
		d.recovered = d3.max([prev.recovered||0, 	d3.max(filteredData, d=>d.recovered) ]);
		d.countries	= d3.max([prev.countries||0,	d3.max(filteredData, d=>d.countries.length) ]);

		prev = d;

	});


	dbg&&console.log('M.nest.daily', M.nest.daily);

//	dbg&&console.log('confirmed', M.nest.daily.map(d=>d.confirmed));
//	dbg&&console.log('deaths', M.nest.daily.map(d=>d.deaths));
//	dbg&&console.log('recovered', M.nest.daily.map(d=>d.recovered));



	prepEvents(fEnd);

}





//------------------------------------------------------------------
//
//------------------------------------------------------------------
function prepEvents(cb)	{

	var f = '['+(fc++)+'] '+arguments.callee.toString().replace(/function\s+/,'').split('(')[0],
	dbg=0, fEnd=function(){ dbg&&console.timeEnd(f); console.groupEnd(f); if (typeof cb=='function') cb() };
	if (dbg){ console.group(f); console.time(f) };


	//-----------------------------
	//  filter
	//-----------------------------
	M.data.events = [];

	try {
		M.data.events = M.data.bnoevents
										.filter(d=>
											d._source=='first41' ||
											d.description.match(/WHO|market|lockdown|doctor/i)
										);
	}catch(e){};


	//-----------------------------
	// build event narratives based on first confirmed/deaths cases
	//-----------------------------

	var max_martine = d3.max(M.data.martine,d=>d.date_str);

	var data = M.data.martine.filter(d=>d.country!='China');
	data = data.concat(
		M.data.jhu.filter(k=>k.date_str>max_martine && !k.country.match(/china/i) )
	);

	data = data.filter(d=>d.country!='Malaysia');

	var countries = d3.nest()
									.key(d=>d.country)
									.entries(data)
									.map(d=>{
										d.first_confirmed = d3.min(d.values,d=>d.date_str);
										d.first_deaths = d3.min(d.values.filter(d=>d.deaths>0),d=>d.date_str)||null;

										d.first_confirmed_cases = d.values.find(k=>k.date_str==d.first_confirmed).confirmed;
										d.first_deaths_cases = d.values.find(k=>k.date_str==d.first_deaths)&&d.values.find(k=>k.date_str==d.first_deaths).deaths||0;

										//d.values.sort(d3.comparator().order(d3.ascending,d=>d.date));


										//-----------------------------
										//  confirmed
										//-----------------------------
										d.values.filter(k=>k.date_str==d.first_confirmed)
											.slice(0,1)
											.forEach(k=>{

												var j={
													date: +moment(k.date_str),
													date_str:k.date_str,
													description: [
														'First',
														(d.first_confirmed_cases==1?'confirmed case':d.first_confirmed_cases+' confirmed cases'),
														'in',
														d.key
													].join(' '),
												};

												j.location = {...k};
												j.location.region = j.location.location||j.location.country;

												M.data.events.push(j);

											});

										//-----------------------------
										// deaths
										//-----------------------------
										if (d.first_deaths){

											d.values.filter(k=>k.date_str==d.first_deaths)
												.slice(0,1)
												.forEach(k=>{

													var j={
														date: +moment(k.date_str),
														date_str:k.date_str,
														description: [
															'First',
															(d.first_deaths_cases==1?'death':d.first_deaths_cases+' deaths'),
															'in',
															d.key
														].join(' '),
													};

													j.location = {...k};
													j.location.region = j.location.location||j.location.country;

													M.data.events.push(j);

												});

										}

										return d;
									});

	dbg&&console.log('countries',countries);

	dbg&&console.log('M.data.events', M.data.events);

	fEnd();
}


