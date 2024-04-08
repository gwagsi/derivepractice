const ctx = document.getElementById('myChart').getContext('2d');

// Function to prepare chart data (assuming array of tick data objects)
function prepareChartData(tickData) {
    const timestamps = tickData.slice(-6).map(tick => tick.epoch); // Get timestamps for last 6 quotes
    const quotes = tickData.slice(-6).map(tick => tick.quote); // Get quotes for last 6 quotes
  

  for (const tick of tickData) {
    timestamps.push(tick.epoch); // Assuming epoch represents timestamps
    quotes.push(tick.quote);
  }

  return {
    labels: timestamps,
    datasets: [
      {
        label: 'Quote',
        data: quotes,
        borderColor: 'rgba(0, 0, 255, 1)', // Blue for quote line
      }
    ]
  };
}

// Initial data (replace with your actual logic to fetch initial data)
const initialTickData = [
  { quote: 1674.41, epoch: 1712480096 },
  { quote: 1674.52, epoch: 1712480196 },
  // ... more initial tick data objects
];

 let latestQuote = initialTickData[initialTickData.length - 1].quote; // Store latest quote

const chartData = prepareChartData(initialTickData);

const myChart = new Chart(ctx, {
  type: 'line', // Line chart for quote movement
  data: chartData,
  // Optional chart configuration options
  scales: {
    yAxes: [{
      ticks: {
       // beginAtZero: true, // Start y-axis at 0 for clear visualization
       autoSkip: true
      }
    }]
  },
  options: {
    maintainAspectRatio: false, // Disable aspect ratio maintenance
  }
});

// Your listener function (replace with your actual listener function name)
export function onNewTick(newTick) {
   // console.log(newTick);
  const newQuote = newTick.quote;
  const newEpoch = newTick.epoch; // Assuming epoch represents timestamps

  //console.log(`New quote: ${newQuote} at ${newEpoch}`);
  // Update chart data
  const quoteDataset = myChart.data.datasets[0];
  quoteDataset.data.push(newQuote);
  myChart.data.labels.push(newEpoch);

  latestQuote = newQuote;
    // Shift out oldest data if exceeding limit
    if (quoteDataset.data.length > 6) {
        quoteDataset.data.shift();
        myChart.data.labels.shift();
      }

//   // Remove existing markers (if any)
//   removeExistingMarkers();

//   // Create and display markers for current quote
//   createQuoteMarkers(newQuote);

  myChart.update();
}

// Function to remove existing markers
function removeExistingMarkers() {
  const chartContainer = document.getElementById('myChart').parentNode;
  const markers = chartContainer.querySelectorAll('.quote-marker');
  for (const marker of markers) {
    marker.remove();
  }
}

// Function to create and display markers for current quote
function createQuoteMarkers(currentQuote) {
    const chartArea = myChart.chartArea;
  
    // Create a container element for markers (optional for better positioning)
    const markerContainer = document.createElement('div');
    markerContainer.style.position = 'absolute';
    markerContainer.style.left = `${chartArea.left}px`;
    markerContainer.style.top = `${chartArea.top}px`;
    markerContainer.style.width = `${chartArea.right - chartArea.left}px`;
    document.getElementById('myChart').parentNode.appendChild(markerContainer);
  
    // Calculate pixel positions for markers
    const yPixelForQuote = myChart.scales['y-axis-0'].getPixelForValue(currentQuote);
  
    // Create markers for slightly above and below the quote
    const markerSize = 5; // Adjust marker size as needed
  
    const upperMarker = document.createElement('div');
    upperMarker.className = 'quote-marker'; // For easy removal
    upperMarker.style.position = 'absolute';
    upperMarker.style.left = `0px`;
    upperMarker.style.top = `${yPixelForQuote - markerSize / 2}px`;
    upperMarker.style.width = `${markerSize}px`;
    upperMarker.style.height = `${markerSize}px`;
    upperMarker.style.backgroundColor = 'red'; // Red for marker above the quote
    upperMarker.style.borderRadius = '50%'; // Circular marker
  
    const lowerMarker = document.createElement('div');
    lowerMarker.className = 'quote-marker'; // For easy removal
    lowerMarker.style.position = 'absolute';
    lowerMarker.style.left = `0px`;
    lowerMarker.style.top = `${yPixelForQuote + markerSize / 2}px`;
    lowerMarker.style.width = `${markerSize}px`;
    lowerMarker.style.height = `${markerSize}px`;
    lowerMarker.style.backgroundColor = 'green'; // Green for marker below the quote
    lowerMarker.style.borderRadius = '50%'; // Circular marker
  
    // Add markers to the container (optional, you can directly append to chart container)
    markerContainer.appendChild(upperMarker);
    markerContainer.appendChild(lowerMarker);
  }
  
