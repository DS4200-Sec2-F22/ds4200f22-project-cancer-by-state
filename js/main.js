// MAP

const M_HEIGHT = 600;
const M_WIDTH = 900;
const M_MARGINS = {left: 50, right: 50, top: 50, bottom: 50};
const LEGEND_SIZE = 300;

const M_VIS_HEIGHT = M_HEIGHT - M_MARGINS.top - M_MARGINS.bottom;
const M_VIS_WIDTH = M_WIDTH - M_MARGINS.left - M_MARGINS.right;

// map frame
const FRAME_MAP = d3.select("#main-map")
						.append("svg")
							.attr("height", M_HEIGHT)
							.attr("width", M_WIDTH)
							.attr("class", "frame");

const FRAME_LEGEND = d3.select("#map-legend")
							.append("svg")
								.attr("height", LEGEND_SIZE)
								.attr("width", LEGEND_SIZE)
								.attr("class", "frame");

// subset of data where row_name = type
function filtered_csv(data, row_name, type) {
		return data.filter((row) => {return row[row_name] == type;})
}


// build map
function build_map() {

	// print 10 lines of data to the console (pm-03 requirement)
	d3.csv("data/cancer_cleaned_data.csv").then((data) => {
		for (let i = 1; i <= 10; i++) {
			    console.log(data[i]);
		}
	})

	// D3 Projection
	let projection = d3.geoAlbersUsa()
						.translate([M_WIDTH / 2, M_HEIGHT / 2])
						.scale([1000]);

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
						.style("font-size", 20)
						.attr("transform", "translate(" + (M_WIDTH / 2) + "," + (M_MARGINS.top - 10) + ")")
					    .text((d) => {
					    	if (cancer_value === "Lymphoma") {
					    		return cancer_value + ": Overall Incidence in the United States";
					    	}
					    	else {
					    		return cancer_value + " Cancer: Overall Incidence in the United States"
					    	}
					    });

			// filter by cancer type to form output
			const cancer_type_data = filtered_csv(data, 'Cancer_type', cancer_text);
			//console.log(cancer_type_data)

			// list of all state names in the data subset
			const all_states = [...new Set(cancer_type_data.map((d) => {return d.State_name}))]; 
			//console.log(all_states)

			// new map data (state and overall incidence ratio)
			let state_ratio_data = [];

			// iterate through states and calculate overall incidence
			for (let i = 0; i < all_states.length; i++) {
				state = all_states[i];
				state_csv = filtered_csv(cancer_type_data, 'State_name', state);

				const total = d3.sum(state_csv, (d) => {return d.Count;})
				const pop = d3.min(state_csv, (d) => {return d.State_population;})
				const ratio = total/pop;

				let state_ratio = {"State":state, "Total":total, "Ratio":ratio}
				state_ratio_data.push(state_ratio);
			}
			//console.log(state_ratio_data)

			// TODO: dictionary for color schemes (different scheme for each cancer type)

			// define quantize scale to sort data values into buckets of color
			const COLOR_SCALE = d3.scaleQuantize().range(d3.schemeGreens[6]);

			// domain for colors and legend
			let min = d3.min(state_ratio_data, (d) => {return d.Ratio;});
			let max = d3.max(state_ratio_data, (d) => {return d.Ratio;});

			// input domain for color scale
			COLOR_SCALE.domain([min, max]);

			// make buckets for legend
			scale = (max - min) / 6;

			// color ratios
			const keys = [min, min + scale, min + (2 * scale), min + (3 * scale), min + (4 * scale), max];

			// clear previous legend
			FRAME_LEGEND.selectAll(".legend-circle").remove();
			FRAME_LEGEND.selectAll(".legend-text").remove();

			// create legend text
			FRAME_LEGEND.selectAll("mydots")
  				.data(keys)
  				.enter()
  					.append("circle")
    				.attr("cx", 100)
    				.attr("cy", function(d,i){ return 100 + i*25}) // 100 is where the first dot appears. 25 is the distance between dots
    				.attr("r", 7)
   				 	.style("fill", function(d){ return COLOR_SCALE(d)})
   				 	.attr("class", "legend-circle");

   			// add one dot in the legend for each name.
			FRAME_LEGEND.selectAll("mylabels")
  				.data(keys)
  				.enter()
  					.append("text")
    				.attr("x", 120)
    				.attr("y", function(d,i){ return 100 + i*25}) // 100 is where the first dot appears. 25 is the distance between dots
    				.text(function(d){ return d.toLocaleString(undefined,{style: 'percent', minimumFractionDigits:4})})
    				.attr("text-anchor", "left")
    				.style("alignment-baseline", "middle")
    				.attr("class", "legend-text");

    		// legend title
			FRAME_LEGEND.append("text")
						.style("text-anchor", "middle")
						.attr("transform", "translate(" + (LEGEND_SIZE / 2) + "," + (M_MARGINS.top + 10) + ")")
					    .text("Legend: Incidence");

			// load in GeoJSON 
			d3.json("us-states.json").then((json) => {

				// merge state_ratio_data and GeoJSON
				// Loop through once for each cancer data value
				for (var i = 0; i < state_ratio_data.length; i++) {
					
					let state_name = state_ratio_data[i].State;
					let state_total = parseFloat(state_ratio_data[i].Total);
					let state_ratio = parseFloat(state_ratio_data[i].Ratio);
					
					//Find the corresponding state inside the GeoJSON
					for (var j = 0; j < json.features.length; j++) {
							
						var json_state = json.features[j].properties.name;
					
						if (state_name == json_state) {
							
							// copy the data values into the JSON
							json.features[j].properties.total = state_total;
							json.features[j].properties.ratio = state_ratio;
									
							// stop looking through the JSON
							break;
									
						}
					}		
				}
				//console.log(json.features)

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
							.style("fill", (d) => {
						   		// get ratio value for fill
						   		let fill_value = d.properties.ratio;
						   		if (fill_value) {
							   		return COLOR_SCALE(fill_value);
						   		} 
						   		else {
							   		return "#ccc";
						   		}
						   });


				// tooltip
				const TOOLTIP = d3.select(("#main-map"))
									.append("div")
										.attr("class", "tooltip")
										.style("opacity", 0);

				// on mouseover, make tooltip opaque
				function mouseover(event, d) {
					TOOLTIP.style("opacity", 1);
				};

				// position tooltip 
				function mousemove(event, d) {
					
					// convert ratio into a percentage
					let percentage = d.properties.ratio
										.toLocaleString(undefined,{style: 'percent', minimumFractionDigits:4});

					// tooltip text					
					TOOLTIP.html("State: " + d.properties.name + 
									"<br>Incidence Rate: " + percentage +
									"<br># of Occurences: " + d.properties.total)
								.style("left", (event.pageX + 10) + "px")
								.style("top", (event.pageY - 50) + "px");
				};

				// on mouseover, make tooltip opaque
				function mouseleave(event, d) {
					TOOLTIP.style("opacity", 0);
				};

				// add event listeners to all of the states
				FRAME_MAP.selectAll(".state")
								.on("mouseover", mouseover)
								.on("mousemove", mousemove)
								.on("mouseleave", mouseleave);

			});

		});
	}
	

	// initialize with default dropdown value
	filter_and_make_map("Colon and Rectum", "Colon and Rectal");

	// event handler so the map rebuilds after each form change
	d3.select("#cancer_dd").on("change", function(event, d) { 
		const selected_text = d3.select('#cancer_dd option:checked').text();
		const selected_value = this.value;

		filter_and_make_map(selected_text, selected_value)});


		// tooltip
		const TOOLTIP = d3.select(("#main-map"))
							.append("div")
								.attr("class", "tooltip")
								.style("opacity", 0);

		// on mouseover, make tooltip opaque
		function mouseover(event, d) {
			TOOLTIP.style("opacity", 1);
		};

		// position tooltip 
		function mousemove(event, d) {
			
			TOOLTIP.html("# of Occurences: " + total)
						.style("left", (event.pageX + 10) + "px")
						.style("top", (event.pageY - 50) + "px");
		};

		// on mouseover, make tooltip opaque
		function mouseleave(event, d) {
			TOOLTIP.style("opacity", 0);
		};

		// add event listeners to all of the states
		FRAME_MAP.selectAll("path")
						.on("mouseover", mouseover)
						.on("mousemove", mousemove)
						.on("mouseleave", mouseleave);

}
build_map();



// PIE CHART

const P_HEIGHT = 400;
const P_WIDTH = 400;
const P_MARGINS = {left: 50, right: 50, top: 50, bottom: 50};

const P_VIS_HEIGHT = P_HEIGHT - P_MARGINS.top - P_MARGINS.bottom;
const P_VIS_WIDTH = P_WIDTH - P_MARGINS.left - P_MARGINS.right;

// pie chart frame
const FRAME_PIE = d3.select("#pie-chart")
						.append("svg")
							.attr("height", P_HEIGHT)
							.attr("width", P_WIDTH)
							.attr("class", "frame");




// SCATTERPLOT

const S_HEIGHT = 400;
const S_WIDTH = 650;
const S_MARGINS = {left: 75, right: 50, top: 50, bottom: 50};

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
						.attr("transform", "translate(" + (S_WIDTH / 2) + "," + (S_MARGINS.top - 10) + ")")
					    .text("Percent below Poverty Line vs. Percent Insured");

		// x-axis scaling (or change to 0-100%?)
		const MIN_X = d3.min(data, (d) => {return parseInt(d.Percentage_population_below_poverty);})
		const MAX_X = d3.max(data, (d) => {return parseInt(d.Percentage_population_below_poverty);})
		const X_SCALE = d3.scaleLinear()
							.domain([MIN_X - 3, MAX_X + 3])
							.range([0, S_VIS_WIDTH]);

		// y-axis scaling (or change to 0-100%?)
		const MIN_Y = d3.min(data, (d) => {return parseInt(d.Percentage_population_insured);})
		const MAX_Y = d3.max(data, (d) => {return parseInt(d.Percentage_population_insured);})
		const Y_SCALE = d3.scaleLinear()
							.domain([MIN_Y - 3, MAX_Y + 3])
							.range([S_VIS_HEIGHT, 0]);

		// point size scaling (by state population)
		const MAX_POINT = d3.max(data, (d) => {return parseInt(d.Population);})
		const POINT_SCALE = d3.scaleLinear()
							.domain([0, MAX_POINT])
							.range([7,20]);

		// x-axis
		FRAME_SCATTER.append("g")
						.attr("transform", "translate(" + S_MARGINS.left + "," + (S_VIS_HEIGHT + S_MARGINS.top) + ")")
						.call(d3.axisBottom(X_SCALE).ticks(10))
							.attr("font-size", "15px")

		// x-axis label
		FRAME_SCATTER.append("text")
						.style("text-anchor", "middle")
						.attr("transform", "translate(" + (S_WIDTH / 2) + "," + (S_HEIGHT - 10) + ")")
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
							.attr("id", (d) => {return d.name;})
							.attr("cx", (d) => {return (S_MARGINS.left + X_SCALE(d.Percentage_population_below_poverty));})
							.attr("cy", (d) => {return (S_MARGINS.top + Y_SCALE(d.Percentage_population_insured));})
							.attr("r", (d) => {return POINT_SCALE(d.Population);})
							.attr("class", "point");

		// tooltip
		const TOOLTIP = d3.select(("#scatterplot"))
							.append("div")
								.attr("class", "tooltip")
								.style("opacity", 0);

		// on mouseover, make tooltip opaque
		function mouseover(event, d) {
			TOOLTIP.style("opacity", 1);
		};

		// position tooltip 
		function mousemove(event, d) {
			TOOLTIP.html("State: " + d.Name + 
							"<br>Percent below Poverty Line: " + d.Percentage_population_below_poverty + "%" + 
							"<br>Percent Insured: " + d.Percentage_population_insured + "%" +
							"<br>Population: " + d.Population)
						.style("left", (event.pageX + 10) + "px")
						.style("top", (event.pageY - 50) + "px");
		};

		// on mouseover, make tooltip opaque
		function mouseleave(event, d) {
			TOOLTIP.style("opacity", 0);
		};

		// add event listeners to all of the bars
		FRAME_SCATTER.selectAll(".point")
						.on("mouseover", mouseover)
						.on("mousemove", mousemove)
						.on("mouseleave", mouseleave);
	})
}
build_scatter();





