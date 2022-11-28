// MAP

const M_HEIGHT = 600;
const M_WIDTH = 700;
const M_MARGINS = {left: 50, right: 50, top: 50, bottom: 50};

const LEGEND_HEIGHT = 200;
let TOOLTIP;

const M_VIS_HEIGHT = M_HEIGHT - M_MARGINS.top - M_MARGINS.bottom;
const M_VIS_WIDTH = M_WIDTH - M_MARGINS.left - M_MARGINS.right;

// map frame
const FRAME_MAP = d3.select("#main-map")
						.append("svg")
							.attr("height", M_HEIGHT)
							.attr("width", M_WIDTH)
							.attr("class", "frame");

// map legend
const FRAME_MAP_LEGEND = d3.select("#map-legend")
								.append("svg")
									.attr("height", LEGEND_HEIGHT)
									.attr("width", M_WIDTH)
									.attr("class", "frame");

// subset of data where row_name = type
function filtered_csv(data, row_name, type) {
		return data.filter((row) => {return row[row_name] == type;});
};


// build map
function build_map() {

	// print 10 lines of data to the console (pm-03 requirement)
	/*d3.csv("data/cancer_cleaned_data.csv").then((data) => {
		for (let i = 1; i <= 10; i++) {
			    console.log(data[i]);
		}
	});*/

	// D3 Projection
	let projection = d3.geoAlbersUsa()
						.translate([M_WIDTH / 2, (M_HEIGHT / 2) - M_MARGINS.top])
						.scale([950]);

	//Define path generator
	let path = d3.geoPath().projection(projection);


	// filters data and creates the map
	function filter_and_make_map(cancer_text, cancer_value) {
		d3.csv("data/cancer_cleaned_data.csv").then((data) => {

			// remove existing title from the frame
			FRAME_MAP.selectAll("text").remove();

			// title
			FRAME_MAP.append("text")
						.style("text-anchor", "middle")
						.attr("transform", "translate(" + (M_WIDTH / 2) + "," + 25 + ")")
					    .text((d) => {
					    	if (cancer_value === "Lymphoma") {
					    		return cancer_value + ": Overall Incidence in the United States";
					    	}
					    	else {
					    		return cancer_value + " Cancer: Overall Incidence in the United States"
					    	}
					    })
					    .attr("class", "title-text");

			// filter by cancer type to form output
			const cancer_type_data = filtered_csv(data, 'Cancer_type', cancer_text);

			// list of all state names in the data subset
			const all_states = [...new Set(cancer_type_data.map((d) => {return d.State_name;}))]; 

			// new map data (state and overall incidence ratio)
			let state_ratio_data = [];

			// iterate through states and calculate overall incidence
			for (let i = 0; i < all_states.length; i++) {
				state = all_states[i];
				state_csv = filtered_csv(cancer_type_data, 'State_name', state);

				const total = d3.sum(state_csv, (d) => {return d.Count;});
				const pop = d3.min(state_csv, (d) => {return d.State_population;});
				const ratio = total/pop;

				let state_ratio = {"State":state, "Total":total, "Ratio":ratio};
				state_ratio_data.push(state_ratio);
			}

			// number of colors in scale
			const colors_n = 6;

			// color palette 
			const palette = d3.schemePurples;

			// domain for colors and legend
			let min = d3.min(state_ratio_data, (d) => {return d.Ratio;});
			let max = d3.max(state_ratio_data, (d) => {return d.Ratio;});

			// define quantize scale to sort data values into buckets of color
			const COLOR_SCALE = d3.scaleQuantize()
									.domain([min, max])
									.range(palette[colors_n]);

			// percentages for each bucket
			let keys = [];
			for (let i=0; i < colors_n; i++) {
				keys.push(COLOR_SCALE.invertExtent(palette[colors_n][i]));
			}

			// load in GeoJSON 
			d3.json("us-states.json").then((json) => {

				// merge state_ratio_data and GeoJSON
				// loop through once for each cancer data value
				for (let i = 0; i < state_ratio_data.length; i++) {
					
					let state_name = state_ratio_data[i].State;
					let state_total = parseFloat(state_ratio_data[i].Total);
					let state_ratio = parseFloat(state_ratio_data[i].Ratio);
					
					//Find the corresponding state inside the GeoJSON
					for (let j = 0; j < json.features.length; j++) {
							
						let json_state = json.features[j].properties.name;
					
						if (state_name == json_state) {
							
							// copy the data values into the JSON
							json.features[j].properties.total = state_total;
							json.features[j].properties.ratio = state_ratio;
									
							// stop looking through the JSON
							break;		
						}
					}		
				}

				// remove existing map data from the frame
				FRAME_MAP.selectAll("path").remove();

				// bind new JSON data and create one path per feature
				FRAME_MAP.selectAll("path")
							.data(json.features)
							.enter()
							.append("path")
							.attr("d", path)
							.attr("class", "state")
							.style("stroke", "white")
							.style("stroke-width", "1")
							.style("fill", (d) => {return COLOR_SCALE(d.properties.ratio);});

				// clear previous legend
				FRAME_MAP.selectAll(".legend-circle").remove();
				FRAME_MAP.selectAll(".legend-text").remove();

	    		// legend title
				FRAME_MAP.append("text")
							.style("text-anchor", "middle")
							.attr("transform", "translate(" + (M_WIDTH / 2) + "," + (M_HEIGHT - 100) + ")")
						    .text("Legend: Incidence")
							.attr("class", "legend-text");

				// add one dot in the legend for each bucket
				FRAME_MAP.selectAll("dots")
	  				.data(keys)
	  				.enter()
	  					.append("circle")
	    				.attr("cx", (d,i) => {
	    					if (i < 3) {
	    						return M_WIDTH * 0.15;
	    					}
	    					else {
	    						return M_WIDTH * 0.6;
	    					}
	    				})
	    				.attr("cy", (d,i) => {
	    					if (i < 3) {
	    						return (M_HEIGHT - 80) + i*25;
	    					}
	    					else {
	    						return (M_HEIGHT - 80) + (i-3)*25;
	    					}
	    				})
	    				.attr("r", 8)
	   				 	.style("fill", (d) => { return COLOR_SCALE(d[0])})
	   				 	.attr("class", "legend-circle");

	   			// create legend text
				FRAME_MAP.selectAll("labels")
	  				.data(keys)
	  				.enter()
	  					.append("text")
	    				.attr("x", (d,i) => {
	    					if (i < 3) {
	    						return (M_WIDTH * 0.15) + 20;
	    					}
	    					else {
	    						return (M_WIDTH * 0.6) + 20
	    					}
	    				})
	    				.attr("y", (d,i) => {
	    					if (i < 3) {
	    						return (M_HEIGHT - 80) + i*25;
	    					}
	    					else {
	    						return (M_HEIGHT - 80) + (i-3)*25;
	    					}
	    				})
	    				.text((d) => { 
	    					let low = d[0].toLocaleString(undefined,{style: 'percent', minimumFractionDigits:4});
	    					let high = d[1].toLocaleString(undefined,{style: 'percent', minimumFractionDigits:4})
	    					return (low + " - " + high);
	    				})
	    				.attr("text-anchor", "left")
	    				.style("alignment-baseline", "middle")
	    				.attr("class", "legend-text");

				// tooltip
				TOOLTIP = d3.select(("#main-map"))
								.append("div")
									.attr("class", "tooltip")
									.style("opacity", 0);

				// on mouseover, make tooltip visible
				function mouseover(event, d) {
					TOOLTIP.style("opacity", 1);
				};

				// position tooltip 
				function mousemove(event, d) {
					
					// convert ratio into a percentage
					let percentage = d.properties.ratio
										.toLocaleString(undefined, {style: 'percent', minimumFractionDigits:4});

					// tooltip text					
					TOOLTIP.html("State: " + d.properties.name + 
									"<br>Incidence Rate: " + percentage +
									"<br>Total Occurences: " + d.properties.total)
								.style("left", (event.pageX + 10) + "px")
								.style("top", (event.pageY - 70) + "px");
				};

				// on mouseleave, make tooltip opaque
				function mouseleave(event, d) {
					TOOLTIP.style("opacity", 0);
				};

				// change pie chart when state is selected
				function change_linked(event, d) {
					// builds the pie chart
					build_pie(cancer_type_data, d.properties.name, cancer_value);

					// highlight the scatterplot point for the state
					highlight_point(d.properties.name);
				};

				// select corresponding point on scatter plot for each state
				function highlight_point(point_name) {
					// reformat point id name
					let point_id = "#" + point_name.replaceAll(" ","_");

					// select point
					let point = d3.select(point_id)["_groups"][0][0];

					// clear highlight from all points
					FRAME_SCATTER.selectAll(".point").classed("selected", false);

					// select point for given state
					FRAME_SCATTER.select(point_id).classed("selected", true);

					// show which state is highlighted
					document.getElementById("highlighted").innerHTML = "Highlighted Point: " + point_name + "<br>";
				};

				// add event listeners to all of the states
				FRAME_MAP.selectAll(".state")
								.on("mouseover", mouseover)
								.on("mousemove", mousemove)
								.on("mouseleave", mouseleave)
								.on("click", change_linked);
			});

		});
	}
	

	// initialize with default dropdown value
	filter_and_make_map("Colon and Rectum", "Colon and Rectal");

	// event handler so the map rebuilds after each form change
	d3.select("#cancer_dd").on("change", function(event, d) { 
		const selected_text = d3.select('#cancer_dd option:checked').text();
		const selected_value = this.value;

		// build new map
		TOOLTIP.remove();
		filter_and_make_map(selected_text, selected_value);

		// reset linked visualizations
		init_pie_chart();
		FRAME_SCATTER.selectAll(".point").classed("selected", false);
	});

}
build_map();



// PIE CHART

const P_HEIGHT = M_HEIGHT;
const P_WIDTH = 450;
const P_MARGINS = {left: 50, right: 50, top: 50, bottom: 50};

const P_VIS_HEIGHT = P_HEIGHT - P_MARGINS.top - P_MARGINS.bottom;
const P_VIS_WIDTH = P_WIDTH - P_MARGINS.left - P_MARGINS.right;
const P_VIS_RADIUS = P_WIDTH/3;

// pie chart frame
const FRAME_PIE = d3.select("#pie-chart")
						.append("svg")
							.attr("height", P_HEIGHT)
							.attr("width", P_WIDTH)
							.attr("class", "frame");


const FRAME_PIE_LEGEND = d3.select("#pie-legend")
								.append("svg")
									.attr("height", LEGEND_HEIGHT)
									.attr("width", P_WIDTH)
									.attr("class", "frame");

// initialize pie chart frame with a prompt to select a state
function init_pie_chart() {

	// remove all previous elements
	FRAME_PIE.selectAll(".title-text").remove();
	FRAME_PIE.selectAll(".slice").remove();
	FRAME_PIE.selectAll(".legend-circle").remove();
	FRAME_PIE.selectAll(".legend-text").remove();

	// lines of text
	FRAME_PIE.append("text")
				.style("text-anchor", "middle")
				.style("font-size", 18)
				.attr("transform", "translate(" + (P_WIDTH / 2) + "," + ((P_WIDTH / 2) - 10) + ")")
			    .text("Select a State in the Map to view")
				.attr("class", "title-text");

	FRAME_PIE.append("text")
				.style("text-anchor", "middle")
				.style("font-size", 18)
				.attr("transform", "translate(" + (P_WIDTH / 2) + "," + ((P_WIDTH / 2) + 15) + ")")
			    .text("the racial breakdown of its Cancer Occurences.") 
				.attr("class", "title-text");
}


// will make this have an input of the cancer_type_data, trigger on click of a state
function build_pie(data, state_name, cancer_name) {

		// remove all previous elements
		FRAME_PIE.selectAll(".title-text").remove();
		FRAME_PIE.selectAll(".slice").remove();
		FRAME_PIE.selectAll(".legend-circle").remove();
		FRAME_PIE.selectAll(".legend-text").remove();

		// title lines
		FRAME_PIE.append("text")
						.style("text-anchor", "middle")
						.style("font-size", 18)
						.attr("transform", "translate(" + (P_WIDTH / 2) + "," + (P_MARGINS.top) + ")")
					    .text((d) => {
					    	if (cancer_name === "Lymphoma") {
					    		return cancer_name + ":";
					    	}
					    	else {
					    		return cancer_name + " Cancer:";
					    	}
					    })
					    .attr("class", "title-text");

		FRAME_PIE.append("text")
						.style("text-anchor", "middle")
						.style("font-size", 18)
						.attr("transform", "translate(" + (P_WIDTH / 2) + "," + (P_MARGINS.top + 25) + ")")
					    .text((d) => {return "Racial Makeup for " + state_name;})
					    .attr("class", "title-text");


		// filter by state
		const state_race_data = filtered_csv(data, 'State_name', state_name);

		// list of all races (hard coded so that it stays consistent between views)
		const all_races = ['American Indian or Alaska Native', 'Asian or Pacific Islander', 'Black or African American', 'White', 'Other Races and Unknown combined'];

		// new pie chart data
		let pie_data = [];

		// iterate through races and calculate percentage
		for (let i = 0; i < state_race_data.length; i++) {
			race = state_race_data[i];

			const count = race.Count;
			const total = d3.sum(state_race_data, (d) => {return d.Count;});
			const ratio = count/total;

			let race_data = {"Race":race.Race_name, "Count":count, "Occurences":total, "Ratio":ratio};
			pie_data.push(race_data);
		};

		// color scale
		const P_COLORS = d3.scaleOrdinal()
                       			.domain(all_races)
  					   			.range(d3.schemeSet2);

		// compute the position of each group on the pie
		let pie = d3.pie()
						.sort(null)
						.value(function(d) {return d.Count;});

		// build arcs
		const arc = d3.arc()
  						.innerRadius(0)
  						.outerRadius(P_VIS_RADIUS);


		// build the pie chart slices
		FRAME_PIE.selectAll('slices')
			  .data(pie(pie_data))
			  .enter()
			  .append('path')
			    .attr('d', arc)
			    .attr('transform', "translate(" + (P_WIDTH / 2) + "," + ((P_WIDTH + P_MARGINS.top) / 2) + ")")
			    .attr('fill', (d) => {return P_COLORS(d.data.Race);})
			    .attr('stroke', 'black')
			    .attr("class", "slice")
			    .style("stroke-width", "1px")
   				.style("opacity", 0.8);

    	// legend title
		FRAME_PIE.append("text")
					.style("text-anchor", "middle")
					.attr("transform", "translate(" + (P_MARGINS.left * 2) + "," + (P_HEIGHT * 0.75) + ")")
					.text("Legend: Race and Count")
					.attr("class", "legend-text");

		// add one dot in the legend for each bucket
		FRAME_PIE.selectAll("dots")
  				.data(pie_data)
  				.enter()
  					.append("circle")
    				.attr("cx", 10)
    				.attr("cy", (d,i) => {return (P_HEIGHT * 0.8) + i*25;})
    				.attr("r", 8)
   				 	.style("fill", (d) => {return P_COLORS(d.Race);})
   				 	.style("opacity", 0.8)
   				 	.attr("class", "legend-circle");

   		// create legend text
		FRAME_PIE.selectAll("labels")
  				.data(pie_data)
  				.enter()
  					.append("text")
    				.attr("x", 30)
    				.attr("y", (d,i) => {return (P_HEIGHT * 0.8) + i*25;})
    				.text((d) => {return d.Race + ": " + d.Count;})
    				.attr("text-anchor", "left")
    				.style("alignment-baseline", "middle")
    				.attr("class", "legend-text");

};
init_pie_chart();


// SCATTERPLOT

const S_HEIGHT = 400;
const S_WIDTH = 800;
const S_MARGINS = {left: 75, right: 50, top: 50, bottom: 60};

const S_VIS_HEIGHT = S_HEIGHT - S_MARGINS.top - S_MARGINS.bottom;
const S_VIS_WIDTH = S_WIDTH - S_MARGINS.left - S_MARGINS.right;

// scatterplot frame
const FRAME_SCATTER = d3.select("#scatterplot")
						.append("svg")
							.attr("height", S_HEIGHT)
							.attr("width", S_WIDTH)
							.attr("class", "frame");

// build scatterplot (no linking yet)
function build_scatter() {
	d3.csv("data/state.csv").then((data) => {

		// title
		FRAME_SCATTER.append("text")
						.style("text-anchor", "middle")
						.style("font-size", 18)
						.attr("transform", "translate(" + (S_VIS_WIDTH / 1.75) + "," + (S_MARGINS.top - 20) + ")")
					    .text("Percent below Poverty Line vs. Percent Insured")
					    .attr("class", "title-text");

		// x-axis scaling (or change to 0-100%?)
		const MIN_X = d3.min(data, (d) => {return parseInt(d.Percentage_population_below_poverty);});
		const MAX_X = d3.max(data, (d) => {return parseInt(d.Percentage_population_below_poverty);});
		const X_SCALE = d3.scaleLinear()
							.domain([MIN_X - 2, MAX_X + 3])
							.range([0, S_VIS_WIDTH]);

		// y-axis scaling (or change to 0-100%?)
		const MIN_Y = d3.min(data, (d) => {return parseInt(d.Percentage_population_insured);});
		const MAX_Y = d3.max(data, (d) => {return parseInt(d.Percentage_population_insured);});
		const Y_SCALE = d3.scaleLinear()
							.domain([MIN_Y - 3, MAX_Y + 3])
							.range([S_VIS_HEIGHT, 0]);

		// point size scaling (by state population)
		const MAX_POINT = d3.max(data, (d) => {return parseInt(d.Population);});
		const POINT_SCALE = d3.scaleLinear()
							.domain([0, MAX_POINT])
							.range([7,25]);

		// x-axis
		FRAME_SCATTER.append("g")
						.attr("transform", "translate(" + S_MARGINS.left + "," + (S_VIS_HEIGHT + S_MARGINS.top) + ")")
						.call(d3.axisBottom(X_SCALE).ticks(10))
							.attr("font-size", "15px");

		// x-axis label
		FRAME_SCATTER.append("text")
						.style("text-anchor", "middle")
						.attr("transform", "translate(" + (S_VIS_WIDTH * 3/5) + "," + (S_HEIGHT - 10) + ")")
					    .text("Percentage below Poverty Line");

		// y-axis
		FRAME_SCATTER.append("g")
						.attr("transform", "translate(" + S_MARGINS.left + "," + S_MARGINS.top + ")")
						.call(d3.axisLeft(Y_SCALE).ticks(8))
							.attr("font-size", "15px");

		// y-axis label
		FRAME_SCATTER.append("text")
						.style("text-anchor", "middle")
						.attr("transform", "rotate(-90)")
					    .attr("y", (S_MARGINS.left - 40))
					    .attr("x", 0 - S_HEIGHT / 2)
					    .text("Percentage Insured");

		// add points for the data
		FRAME_SCATTER.selectAll("points")
						.data(data)
						.enter()
						.append("circle")
							.attr("id", (d) => {return d.Name.replaceAll(" ","_");})
							.attr("cx", (d) => {return (S_MARGINS.left + X_SCALE(d.Percentage_population_below_poverty));})
							.attr("cy", (d) => {return (S_MARGINS.top + Y_SCALE(d.Percentage_population_insured));})
							.attr("r", (d) => {return POINT_SCALE(d.Population);})
							.attr("class", "point");

		// info on hover "tooltip"
		const TOOLTIP_WIDTH = 300;
		const TOOLTIP_S = d3.select("#scatterplot-text")
							.append("div")
								.attr("id", "scatter-tooltip")
								.attr("class", "flex-row")
								.style("width", TOOLTIP_WIDTH + "px")
								.style("opacity", 0);

		// on mouseover, make tooltip opaque
		function mouseover(event, d) {
			TOOLTIP_S.style("opacity", 1);
		};

		// position tooltip 
		function mousemove(event, d) {
			TOOLTIP_S.html("State: " + d.Name + 
							"<br>Percent below Poverty Line: " + d.Percentage_population_below_poverty + "%" + 
							"<br>Percent Insured: " + d.Percentage_population_insured + "%" +
							"<br>Population: " + d.Population);
		};

		// on mouseover, make tooltip opaque
		function mouseleave(event, d) {
			TOOLTIP_S.style("opacity", 0);
		};

		// add event listeners to all of the bars
		FRAME_SCATTER.selectAll(".point")
						.on("mouseover", mouseover)
						.on("mousemove", mousemove)
						.on("mouseleave", mouseleave);
	});
};
build_scatter();




