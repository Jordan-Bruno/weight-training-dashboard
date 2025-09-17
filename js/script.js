const csvUrl = "./documents/training_log.csv";
let allData = [];
const parseDate = d3.timeParse("%d/%m/%Y");
const formatDate = d3.timeFormat("%Y-%m-%d");

// Exercises to exclude
const EXCLUDED_EXERCISES = new Set(["Barbell Row"]);

function loadCSV(url) {
  d3.csv(url).then((data) => {
    data.forEach((d) => {
      d.Date = parseDate(d.Date);
      d.WorkingWeight = +d.WorkingWeight || 0; // coerce, avoid NaN
    });
    allData = data;
    drawLineChart();
    populateTables();
  });
}

function getActiveData() {
  // filter out removed exercises
  return allData.filter((d) => !EXCLUDED_EXERCISES.has(d.Exercise));
}

function drawLineChart() {
  const data = getActiveData();
  const grouped = d3.group(data, (d) => d.Exercise);
  const traces = [];

  grouped.forEach((values, key) => {
    values.sort((a, b) => a.Date - b.Date);
    traces.push({
      x: values.map((d) => d.Date),
      y: values.map((d) => d.WorkingWeight),
      mode: "lines+markers",
      name: key,
    });
  });

  const layout = {
    responsive: true,
    margin: {
      t: 30,
      r: 20,
      b: 80,
      l: 50
    },
    xaxis: {
      title: "Date",
      tickformat: "%d/%m/%Y"
    },
    yaxis: {
      title: "Weight (kg)"
    },
  };

  setTimeout(() => {
    Plotly.newPlot("chart", traces, layout, {
      responsive: true
    }).then(() => {
      window.dispatchEvent(new Event("resize"));
    });
  }, 200);
}

function populateTables() {
  const data = getActiveData();
  const totalReps = new Map();
  const personalBests = new Map();

  data.forEach((d) => {
    const reps = [+d.Reps1, +d.Reps2, +d.Reps3];
    for (let i = 1; i <= 5; i++) reps.push(+d[`WR${i}`] || 0);
    const repSum = reps.reduce((a, b) => a + (isFinite(b) ? b : 0), 0);

    totalReps.set(d.Exercise, (totalReps.get(d.Exercise) || 0) + repSum);

    // only record PBs for positive weights
    if (
      d.WorkingWeight > 0 &&
      (!personalBests.has(d.Exercise) ||
        d.WorkingWeight > personalBests.get(d.Exercise).weight)
    ) {
      personalBests.set(d.Exercise, {
        weight: d.WorkingWeight,
        date: d.Date
      });
    }
  });

  const repsBody = document.querySelector("#repsTable tbody");
  repsBody.innerHTML = "";
  totalReps.forEach((reps, ex) => {
    repsBody.insertAdjacentHTML(
      "beforeend",
      `<tr><td>${ex}</td><td>${reps}</td></tr>`
    );
  });

  const pbBody = document.querySelector("#pbTable tbody");
  pbBody.innerHTML = "";
  personalBests.forEach((data, ex) => {
    pbBody.insertAdjacentHTML(
      "beforeend",
      `<tr><td>${ex}</td><td>${data.weight}</td><td>${data.date.toLocaleDateString()}</td></tr>`
    );
  });
}

function lookupDate() {
  const selected = document.getElementById("dateLookup").value;
  if (!selected) return;

  // match date, then exclude removed exercises
  const filtered = getActiveData().filter((d) => formatDate(d.Date) === selected);

  const log = document.getElementById("workout-log");
  const tables = document.getElementById("tables-section");
  if (filtered.length === 0) {
    log.innerHTML = "<p>No workout recorded on this date.</p>";
  } else {
    log.innerHTML =
      filtered
      .map((d) => {
        const warmups = [];
        for (let i = 1; i <= 5; i++) {
          if (d[`WU${i}`] && d[`WR${i}`])
            warmups.push(`${d[`WU${i}`]}kg x ${d[`WR${i}`]}`);
        }

        const repsArray = [d.Reps1, d.Reps2, d.Reps3].filter((r) => r);
        const reps = repsArray.join(", ");

        return `<div class='mb-2'><strong>${d.Exercise}</strong><br>
          Warm-ups: ${warmups.length ? warmups.join(", ") : "None"}<br>
          Sets: ${d.WorkingWeight}kg x ${reps || "0"}<br>
          Notes: ${d.Notes || "None"}</div>`;
      })
      .join("") +
      '<button class="btn btn-sm btn-dark mt-2" onclick="closeLog()">Close</button>';
  }

  log.style.display = "block";
  tables.style.display = "none";
}

function closeLog() {
  document.getElementById("workout-log").style.display = "none";
  document.getElementById("tables-section").style.display = "block";
}

window.addEventListener("DOMContentLoaded", () => {
  loadCSV(csvUrl);
});