const state = {
  reviews: [
    { channel: "현장 인터뷰", place: "조치원읍", tone: "부정", text: "버스 배차가 길고 야간 이동이 어렵다", count: 4, url: "" },
    { channel: "지역 커뮤니티", place: "읍면 지역", tone: "부정", text: "주말에 갈 문화공간과 가족 체류 공간이 부족하다", count: 3, url: "" },
    { channel: "지도/블로그 후기", place: "행복도시", tone: "긍정", text: "공원과 체육시설은 좋지만 구도심으로 이동하기 불편하다", count: 2, url: "" }
  ],
  compares: [
    { item: "문화시설 접근성", old: "도보 접근 시설 적음", target: "생활권 내 접근 가능", result: "격차 큼", memo: "시설 수와 프로그램 수 분리 확인" },
    { item: "대중교통 연결성", old: "배차간격 길고 환승 부담", target: "BRT·주요 거점 접근 우수", result: "격차 큼", memo: "야간·주말 시간대 확인" },
    { item: "상권 다양성", old: "전통상권 중심", target: "생활·여가 업종 다양", result: "중간", memo: "업종 다양도 비교" }
  ],
  metrics: [
    { name: "인구 1만 명당 문화시설 수", category: "문화", oldValue: 1.8, compareValue: 3.4, unit: "개/1만명", source: "문화포털·세종시" },
    { name: "대중교통 접근성 점수", category: "교통", oldValue: 52, compareValue: 78, unit: "점", source: "KTDB·버스정보" },
    { name: "생활밀착 점포 수", category: "상권", oldValue: 84, compareValue: 112, unit: "개/1만명", source: "상가업소정보" }
  ]
};

const stopwords = new Set(["그리고", "하지만", "있다", "없다", "많다", "적다", "매우", "너무", "정말", "조금", "대한", "에서", "으로", "하다", "된다", "같다"]);

function $(selector) {
  return document.querySelector(selector);
}

function switchView(view) {
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  document.querySelectorAll(".stage").forEach((stage) => stage.classList.toggle("active", stage.id === `view-${view}`));
  if (view === "problem") updateBrief();
}

function gapRate(oldValue, compareValue) {
  const oldNumber = Number(oldValue);
  const compareNumber = Number(compareValue);
  const base = Math.max(oldNumber, compareNumber);
  if (!base) return 0;
  return Math.abs(compareNumber - oldNumber) / base * 100;
}

function renderReviews() {
  $("#reviewRows").innerHTML = state.reviews.map((review, index) => `
    <tr>
      <td>${review.channel}</td>
      <td>${review.place}</td>
      <td>${review.tone}</td>
      <td>${review.text}</td>
      <td>${review.count}</td>
      <td><button class="delete" type="button" data-delete-review="${index}">삭제</button></td>
    </tr>
  `).join("");
  renderKeywords();
  updateStats();
}

function renderKeywords() {
  const counts = new Map();
  state.reviews.forEach((review) => {
    review.text
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 2 && !stopwords.has(word))
      .forEach((word) => counts.set(word, (counts.get(word) || 0) + Number(review.count || 1)));
  });

  const chips = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  $("#keywordChips").innerHTML = chips.map(([word, count]) => `<span>${word} ${count}</span>`).join("") || "<p>후기를 입력하세요.</p>";
}

function addReview() {
  const text = $("#reviewText").value.trim();
  if (!text) return;
  state.reviews.push({
    channel: $("#reviewChannel").value,
    place: $("#reviewPlace").value.trim() || "미입력",
    tone: $("#reviewTone").value,
    text,
    count: Number($("#reviewCount").value || 1),
    url: $("#reviewUrl").value.trim()
  });
  $("#reviewText").value = "";
  $("#reviewUrl").value = "";
  renderAll();
}

function renderCompare() {
  $("#compareRows").innerHTML = state.compares.map((row, index) => `
    <tr>
      <td><input value="${row.item}" data-compare="${index}" data-field="item"></td>
      <td><input value="${row.old}" data-compare="${index}" data-field="old"></td>
      <td><input value="${row.target}" data-compare="${index}" data-field="target"></td>
      <td><input value="${row.result}" data-compare="${index}" data-field="result"></td>
      <td><input value="${row.memo}" data-compare="${index}" data-field="memo"></td>
    </tr>
  `).join("");
}

function renderMetrics() {
  $("#metricRows").innerHTML = state.metrics.map((row, index) => `
    <tr>
      <td><input value="${row.name}" data-metric="${index}" data-field="name"></td>
      <td>
        <select data-metric="${index}" data-field="category">
          ${["생활", "문화", "상권", "교통", "인프라"].map((item) => `<option ${item === row.category ? "selected" : ""}>${item}</option>`).join("")}
        </select>
      </td>
      <td><input type="number" step="0.01" value="${row.oldValue}" data-metric="${index}" data-field="oldValue"></td>
      <td><input type="number" step="0.01" value="${row.compareValue}" data-metric="${index}" data-field="compareValue"></td>
      <td><input value="${row.unit}" data-metric="${index}" data-field="unit"></td>
      <td><input value="${row.source}" data-metric="${index}" data-field="source"></td>
      <td><button class="delete" type="button" data-delete-metric="${index}">삭제</button></td>
    </tr>
  `).join("");
  updateStats();
}

function updateStats() {
  const rates = state.metrics.map((metric) => gapRate(metric.oldValue, metric.compareValue));
  const averageGap = rates.length ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : 0;
  const negativeTotal = state.reviews.filter((review) => review.tone === "부정").reduce((sum, review) => sum + Number(review.count || 1), 0);
  const reviewTotal = state.reviews.reduce((sum, review) => sum + Number(review.count || 1), 0);
  $("#gapScore").textContent = Math.round(averageGap);
  $("#negativeRate").textContent = `${reviewTotal ? Math.round(negativeTotal / reviewTotal * 100) : 0}%`;
  $("#oldAverageGap").textContent = `-${Math.round(averageGap)}%`;
}

function strongestMetric() {
  return [...state.metrics].sort((a, b) => gapRate(b.oldValue, b.compareValue) - gapRate(a.oldValue, a.compareValue))[0];
}

function updateBrief() {
  const metric = strongestMetric();
  const negativeCount = state.reviews.filter((review) => review.tone === "부정").reduce((sum, review) => sum + Number(review.count || 1), 0);
  const topReviews = state.reviews.filter((review) => review.tone === "부정").slice(0, 3);
  const compareSummary = state.compares.filter((row) => row.result.includes("격차") || row.result.includes("큼")).slice(0, 2);

  const problem = metric
    ? `세종시 구도심은 ${metric.category} 분야에서 신도심 또는 목표 기준 대비 격차가 나타나며, 후기조사에서도 이동·문화·생활권 불편이 반복된다.`
    : "정량 지표를 입력하면 정책 문제 문장이 생성됩니다.";
  const evidence = [
    `부정 후기 ${negativeCount}건, 반복 키워드 ${$("#keywordChips").innerText || "미도출"}`,
    metric ? `대표 정량 지표: ${metric.name}, 구도심 ${metric.oldValue}${metric.unit}, 비교 ${metric.compareValue}${metric.unit}, 격차 ${gapRate(metric.oldValue, metric.compareValue).toFixed(1)}% (${metric.source})` : "대표 정량 지표 미입력",
    ...topReviews.map((review) => `후기: ${review.place} - ${review.text} (${review.count}회)`)
  ].join("\n");
  const cause = compareSummary.length
    ? compareSummary.map((row) => `${row.item}: ${row.old} / ${row.memo}`).join("\n")
    : "시설 공급 부족, 배차·환승 불편, 생활권별 수요 불일치 중 어느 원인이 큰지 추가 확인이 필요하다.";
  const opportunity = "구도심 생활권 문화공간, 야간·주말 프로그램, 신도심-구도심 연계 교통, 상권 체류 콘텐츠를 묶은 생활권 단위 정책 패키지를 검토한다.";

  $("#problemText").value = problem;
  $("#evidenceText").value = evidence;
  $("#causeText").value = cause;
  $("#opportunityText").value = opportunity;
  $("#briefPreview").textContent = `[정책 문제]\n${problem}\n\n[정량 근거]\n${evidence}\n\n[원인 가설]\n${cause}\n\n[정책 기회]\n${opportunity}`;
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json;charset=utf-8" });
  downloadBlob(blob, "sejong-gap-workbench.json");
}

function exportCsv() {
  const header = ["지표", "분야", "구도심 값", "비교 값", "단위", "출처", "격차율"];
  const lines = state.metrics.map((metric) => [metric.name, metric.category, metric.oldValue, metric.compareValue, metric.unit, metric.source, gapRate(metric.oldValue, metric.compareValue).toFixed(1)]
    .map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
  const blob = new Blob(["\ufeff" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, "sejong-gap-metrics.csv");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function copyBrief() {
  updateBrief();
  navigator.clipboard.writeText($("#briefPreview").textContent);
  $("#copyBrief").textContent = "복사 완료";
  setTimeout(() => {
    $("#copyBrief").textContent = "브리프 복사";
  }, 1200);
}

function loadDemo() {
  state.reviews = [
    { channel: "현장 인터뷰", place: "조치원읍", tone: "부정", text: "버스 배차가 길고 야간 이동이 어렵다", count: 4, url: "" },
    { channel: "지역 커뮤니티", place: "읍면 지역", tone: "부정", text: "주말에 갈 문화공간과 가족 체류 공간이 부족하다", count: 3, url: "" },
    { channel: "지도/블로그 후기", place: "행복도시", tone: "긍정", text: "공원과 체육시설은 좋지만 구도심으로 이동하기 불편하다", count: 2, url: "" }
  ];
  state.metrics = [
    { name: "인구 1만 명당 문화시설 수", category: "문화", oldValue: 1.8, compareValue: 3.4, unit: "개/1만명", source: "문화포털·세종시" },
    { name: "대중교통 접근성 점수", category: "교통", oldValue: 52, compareValue: 78, unit: "점", source: "KTDB·버스정보" },
    { name: "생활밀착 점포 수", category: "상권", oldValue: 84, compareValue: 112, unit: "개/1만명", source: "상가업소정보" }
  ];
  renderAll();
}

function renderAll() {
  renderReviews();
  renderCompare();
  renderMetrics();
  updateBrief();
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (target.matches(".nav-item")) switchView(target.dataset.view);
  if (target.matches("[data-delete-review]")) {
    state.reviews.splice(Number(target.dataset.deleteReview), 1);
    renderAll();
  }
  if (target.matches("[data-delete-metric]")) {
    state.metrics.splice(Number(target.dataset.deleteMetric), 1);
    renderAll();
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.dataset.metric) {
    const row = state.metrics[Number(target.dataset.metric)];
    row[target.dataset.field] = target.type === "number" ? Number(target.value) : target.value;
    updateStats();
    updateBrief();
  }
  if (target.dataset.compare) {
    state.compares[Number(target.dataset.compare)][target.dataset.field] = target.value;
    updateBrief();
  }
});

$("#addReview").addEventListener("click", addReview);
$("#resetReviews").addEventListener("click", () => {
  state.reviews = [];
  renderAll();
});
$("#addCompare").addEventListener("click", () => {
  state.compares.push({ item: "새 비교 항목", old: "", target: "", result: "", memo: "" });
  renderAll();
});
$("#addMetric").addEventListener("click", () => {
  state.metrics.push({ name: "새 지표", category: "생활", oldValue: 0, compareValue: 0, unit: "", source: "" });
  renderAll();
});
$("#copyBrief").addEventListener("click", copyBrief);
$("#exportJson").addEventListener("click", exportJson);
$("#exportCsv").addEventListener("click", exportCsv);
$("#loadDemo").addEventListener("click", loadDemo);

renderAll();
