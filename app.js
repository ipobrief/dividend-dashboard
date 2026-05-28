let currentTab = "us";
let sortState = { us: { key: "yield", asc: false }, kr: { key: "yield", asc: false } };

document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    setupFilters();
    setupSorting();
    setupSimulator();
    render();
});

function setupTabs() {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentTab = btn.dataset.tab;
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            document.getElementById("tab-" + currentTab).classList.add("active");
            render();
        });
    });
}

function setupFilters() {
    document.querySelectorAll(".filters select").forEach(sel => {
        sel.addEventListener("change", render);
    });
    document.getElementById("btn-reset").addEventListener("click", () => {
        document.getElementById("filter-yield").value = "0";
        document.getElementById("filter-payout").value = "0";
        document.getElementById("filter-fcf").value = "0";
        document.getElementById("filter-revenue").value = "-999";
        document.getElementById("filter-streak").value = "0";
        document.getElementById("filter-sector").value = "";
        render();
    });
}

function setupSorting() {
    document.querySelectorAll("th[data-sort]").forEach(th => {
        th.addEventListener("click", () => {
            const table = th.closest("table");
            const market = table.id === "table-us" ? "us" : "kr";
            const key = th.dataset.sort;
            if (sortState[market].key === key) {
                sortState[market].asc = !sortState[market].asc;
            } else {
                sortState[market] = { key, asc: false };
            }
            table.querySelectorAll("th").forEach(h => h.classList.remove("sorted", "asc", "desc"));
            th.classList.add("sorted", sortState[market].asc ? "asc" : "desc");
            render();
        });
    });
}

function getFilters() {
    return {
        yield: +document.getElementById("filter-yield").value,
        payout: +document.getElementById("filter-payout").value,
        fcf: +document.getElementById("filter-fcf").value,
        revenue: +document.getElementById("filter-revenue").value,
        streak: +document.getElementById("filter-streak").value,
        sector: document.getElementById("filter-sector").value,
    };
}

function filterData(data) {
    const f = getFilters();
    return data.filter(s =>
        s.yield >= f.yield &&
        s.payoutRatio >= f.payout &&
        s.fcfMargin >= f.fcf &&
        s.revenueGrowth >= f.revenue &&
        s.streak >= f.streak &&
        (!f.sector || s.sector === f.sector)
    );
}

function sortData(data, market) {
    const { key, asc } = sortState[market];
    return [...data].sort((a, b) => {
        const va = typeof a[key] === "string" ? a[key] : +a[key];
        const vb = typeof b[key] === "string" ? b[key] : +b[key];
        if (va < vb) return asc ? -1 : 1;
        if (va > vb) return asc ? 1 : -1;
        return 0;
    });
}

function sparkline(history, color) {
    if (!history || history.length < 2) return "";
    const col = color || "#6c5ce7";
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;
    const w = 80, h = 28, pad = 2;
    const points = history.map((v, i) => {
        const x = pad + (i / (history.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v - min) / range) * (h - pad * 2);
        return `${x},${y}`;
    });
    return `<svg class="sparkline" viewBox="0 0 ${w} ${h}">
        <polyline points="${points.join(" ")}" fill="none" stroke="${col}" stroke-width="1.5"/>
        <circle cx="${points[points.length-1].split(",")[0]}" cy="${points[points.length-1].split(",")[1]}" r="2" fill="${col}"/>
    </svg>`;
}

function getPriceReturnPeriod() {
    const streak = +document.getElementById("filter-streak").value;
    if (streak >= 10) return { years: 10, key: "pr10Y" };
    if (streak >= 5) return { years: 5, key: "pr5Y" };
    if (streak >= 3) return { years: 3, key: "pr3Y" };
    return { years: 5, key: "pr5Y" }; // 기본 5년
}

function renderPriceReturn(s) {
    const period = getPriceReturnPeriod();
    const ret = s[period.key];
    const ph = s.priceHistory || [];

    // 기간에 맞게 price history 슬라이스
    const years = period.years;
    const sliced = ph.length > years ? ph.slice(ph.length - years - 1) : ph;

    let retText = "-";
    let retClass = "";
    if (ret != null && !isNaN(ret)) {
        retText = (ret >= 0 ? "+" : "") + ret.toFixed(1) + "%";
        retClass = ret >= 0 ? "positive" : "negative";
    }

    const color = (ret != null && ret >= 0) ? "#00b894" : "#ff6b6b";
    const chart = sliced.length >= 2 ? sparkline(sliced, color) : "";

    return `<td class="${retClass}" style="white-space:nowrap">
        <span style="font-size:12px;font-weight:600">${retText}</span>
        <span style="display:inline-block;vertical-align:middle;margin-left:4px">${chart}</span>
    </td>`;
}

function renderTable(data, market, tableId) {
    const filtered = filterData(data);
    const sorted = sortData(filtered, market);
    const tbody = document.querySelector(`#${tableId} tbody`);
    const isKR = market === "kr";
    const currency = isKR ? "원" : "$";

    const n = (v, d) => (v != null && !isNaN(v)) ? Number(v).toFixed(d) : "-";
    tbody.innerHTML = sorted.map(s => {
        const hist = (s.divHistory || []).filter(v => v > 0);
        const link = isKR
            ? `https://finance.naver.com/item/main.naver?code=${s.ticker}`
            : `https://finance.yahoo.com/quote/${s.ticker}`;
        return `
        <tr>
            <td><a href="${link}" target="_blank" rel="noopener">${s.ticker}</a></td>
            <td><a href="${link}" target="_blank" rel="noopener">${s.name}</a></td>
            <td>${s.sector || "-"}</td>
            <td>${isKR ? (s.price || 0).toLocaleString() : n(s.price, 1)}</td>
            <td class="${(s.yield || 0) >= 3 ? "positive" : ""}">${n(s.yield, 1)}</td>
            <td>${n(s.payoutRatio, 0)}</td>
            <td class="positive">${n(s.divGrowth5Y, 1)}</td>
            <td class="${(s.streak || 0) >= 25 ? "positive" : ""}">${s.streak || 0}</td>
            <td class="${(s.fcfMargin || 0) >= 20 ? "positive" : ""}">${n(s.fcfMargin, 1)}</td>
            <td>${n(s.fcfPayoutRatio, 0)}</td>
            <td class="${(s.revenueGrowth || 0) >= 10 ? "positive" : ""}">${n(s.revenueGrowth, 1)}</td>
            <td>${n(s.per, 1)}</td>
            ${renderPriceReturn(s)}
        </tr>`;
    }).join("");

    return sorted;
}

function updateStats(usData, krData) {
    const data = currentTab === "us" ? usData : currentTab === "kr" ? krData : currentTab === "etf" ? [...(typeof US_ETFS!=='undefined'?US_ETFS:[]), ...(typeof KR_ETFS!=='undefined'?KR_ETFS:[])] : [...usData, ...krData];
    if (data.length === 0) {
        document.getElementById("stat-count").textContent = "0";
        document.getElementById("stat-avg-yield").textContent = "0%";
        document.getElementById("stat-avg-growth").textContent = "0%";
        document.getElementById("stat-avg-fcf").textContent = "0%";
        return;
    }
    const avg = (arr, key) => (arr.reduce((s, v) => s + v[key], 0) / arr.length).toFixed(1);
    document.getElementById("stat-count").textContent = data.length;
    document.getElementById("stat-avg-yield").textContent = avg(data, "yield") + "%";
    document.getElementById("stat-avg-growth").textContent = avg(data, "divGrowth5Y") + "%";
    document.getElementById("stat-avg-fcf").textContent = avg(data, "fcfMargin") + "%";
}

function renderCompare(usData, krData) {
    renderBarChart("canvas-compare", usData, krData);
    renderSectorChart("canvas-sector", usData, krData);
}

function renderBarChart(canvasId, usData, krData) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;

    ctx.clearRect(0, 0, W, H);

    const metrics = [
        { label: "시가배당률", key: "yield", unit: "%" },
        { label: "배당성향", key: "payoutRatio", unit: "%" },
        { label: "배당성장률", key: "divGrowth5Y", unit: "%" },
        { label: "FCF마진", key: "fcfMargin", unit: "%" },
        { label: "매출성장률", key: "revenueGrowth", unit: "%" },
        { label: "PER", key: "per", unit: "" },
    ];

    const avg = (arr, key) => arr.length ? arr.reduce((s, v) => s + v[key], 0) / arr.length : 0;
    const maxVal = Math.max(...metrics.map(m => Math.max(avg(usData, m.key), avg(krData, m.key))));

    const labelW = 80, barH = 16, gap = 28, startY = 20, chartW = W - labelW - 60;

    metrics.forEach((m, i) => {
        const y = startY + i * (barH * 2 + gap);
        const usVal = avg(usData, m.key);
        const krVal = avg(krData, m.key);

        ctx.fillStyle = "#8b8fa3";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(m.label, labelW - 8, y + barH / 2 + 4);

        // US bar
        const usW = (usVal / maxVal) * chartW;
        ctx.fillStyle = "#6c5ce7";
        ctx.beginPath();
        ctx.roundRect(labelW, y, usW, barH, 3);
        ctx.fill();
        ctx.fillStyle = "#e4e6f0";
        ctx.textAlign = "left";
        ctx.font = "10px sans-serif";
        ctx.fillText(`🇺🇸 ${usVal.toFixed(1)}${m.unit}`, labelW + usW + 4, y + barH / 2 + 3);

        // KR bar
        const krW = (krVal / maxVal) * chartW;
        ctx.fillStyle = "#00b894";
        ctx.beginPath();
        ctx.roundRect(labelW, y + barH + 2, krW, barH, 3);
        ctx.fill();
        ctx.fillStyle = "#e4e6f0";
        ctx.fillText(`🇰🇷 ${krVal.toFixed(1)}${m.unit}`, labelW + krW + 4, y + barH * 2 + 5);
    });
}

function renderSectorChart(canvasId, usData, krData) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const allData = [...usData, ...krData];
    const sectors = [...new Set(allData.map(s => s.sector))].sort();

    const sectorAvg = sectors.map(sec => {
        const items = allData.filter(s => s.sector === sec);
        return {
            sector: sec,
            yield: items.reduce((s, v) => s + v.yield, 0) / items.length,
            count: items.length,
        };
    }).sort((a, b) => b.yield - a.yield);

    const maxY = Math.max(...sectorAvg.map(s => s.yield));
    const labelH = 60, chartH = H - labelH - 20, startX = 50;
    const barW = Math.min(40, (W - startX - 20) / sectorAvg.length - 8);
    const totalW = sectorAvg.length * (barW + 8);
    const offsetX = startX + (W - startX - totalW) / 2;

    const colors = ["#6c5ce7", "#00b894", "#74b9ff", "#fdcb6e", "#e17055", "#a29bfe", "#55efc4", "#fab1a0", "#81ecec", "#dfe6e9"];

    sectorAvg.forEach((s, i) => {
        const x = offsetX + i * (barW + 8);
        const h = (s.yield / maxY) * chartH;
        const y = 20 + chartH - h;

        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, [3, 3, 0, 0]);
        ctx.fill();

        ctx.fillStyle = "#e4e6f0";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(s.yield.toFixed(1) + "%", x + barW / 2, y - 4);

        ctx.save();
        ctx.translate(x + barW / 2, H - labelH + 14);
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = "#8b8fa3";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(s.sector, 0, 0);
        ctx.restore();
    });
}

function renderETFTable(data, tableId) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    const isKR = tableId.includes("kr");

    const sorted = [...data].sort((a, b) => (b.yield || 0) - (a.yield || 0));

    const n = (v, d) => (v != null && !isNaN(v)) ? Number(v).toFixed(d) : "-";

    tbody.innerHTML = sorted.map(s => {
        let freqClass = "quarterly";
        const freq = s.divFreq || "분기";
        if (freq === "월배당") freqClass = "monthly";
        else if (freq === "연1회") freqClass = "annual";

        const hist = (s.divHistory || []).filter(v => v > 0);
        const r1y = s.return1Y;
        const r3y = s.return3Y;

        const etfLink = isKR
            ? `https://finance.naver.com/item/main.naver?code=${s.ticker}`
            : `https://finance.yahoo.com/quote/${s.ticker}`;
        return `
        <tr>
            <td><a href="${etfLink}" target="_blank" rel="noopener">${s.ticker}</a></td>
            <td><a href="${etfLink}" target="_blank" rel="noopener">${s.name}</a></td>
            <td>${s.category || s.sector || "-"}</td>
            <td>${isKR ? (s.price || 0).toLocaleString() : n(s.price, 1)}</td>
            <td class="${(s.yield || 0) >= 3 ? "positive" : ""}">${n(s.yield, 1)}</td>
            <td class="${(s.divGrowth5Y || 0) > 0 ? "positive" : ""}">${(s.divGrowth5Y || 0) > 0 ? n(s.divGrowth5Y, 1) : "-"}</td>
            <td>${n(s.expenseRatio, 2)}</td>
            <td>${s.aum || "-"}</td>
            <td>${s.holdings ? s.holdings.toLocaleString() : "-"}</td>
            <td class="${(r1y || 0) >= 15 ? "positive" : ""}">${r1y != null ? n(r1y, 1) : "-"}</td>
            <td>${r3y != null && r3y > 0 ? n(r3y, 1) : "-"}</td>
            <td><span class="freq-badge ${freqClass}">${freq}</span></td>
            ${renderPriceReturn(s)}
        </tr>
    `}).join("");
}

function setupSimulator() {
    const amountInput = document.getElementById("sim-amount");
    amountInput.addEventListener("input", () => {
        let v = amountInput.value.replace(/[^\d]/g, "");
        amountInput.value = v ? Number(v).toLocaleString() : "";
    });
    document.getElementById("btn-simulate").addEventListener("click", runSimulation);
}

function runSimulation() {
    const amount = Number(document.getElementById("sim-amount").value.replace(/[^\d]/g, ""));
    if (!amount || amount <= 0) return;

    const market = document.getElementById("sim-market").value;
    const allocType = document.getElementById("sim-alloc").value;
    const applyTax = document.getElementById("sim-tax").value === "yes";
    const taxRate = 0.154;

    let pool = [];
    const usFiltered = filterData(US_STOCKS);
    const krFiltered = filterData(KR_STOCKS);
    if (market === "us" || market === "both") pool.push(...usFiltered);
    if (market === "kr" || market === "both") pool.push(...krFiltered);
    if (market === "etf-us" || market === "etf-both") pool.push(...US_ETFS);
    if (market === "etf-kr" || market === "etf-both") pool.push(...KR_ETFS);

    if (pool.length === 0) {
        document.getElementById("sim-results").style.display = "none";
        return;
    }

    pool.sort((a, b) => b.yield - a.yield);

    if (allocType === "top3") pool = pool.slice(0, 3);
    else if (allocType === "top5") pool = pool.slice(0, 5);

    let weights;
    if (allocType === "yield") {
        const totalYield = pool.reduce((s, v) => s + v.yield, 0);
        weights = pool.map(s => s.yield / totalYield);
    } else {
        weights = pool.map(() => 1 / pool.length);
    }

    const monthNames = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
    const monthlyDiv = Array(12).fill(0);
    const monthlyStocks = Array.from({ length: 12 }, () => []);

    const rows = pool.map((s, i) => {
        const investKRW = amount * weights[i];
        const priceKRW = s.currency === "USD" ? s.price * EXCHANGE_RATE : s.price;
        const shares = Math.floor(investKRW / priceKRW);
        const actualInvest = shares * priceKRW;

        const annualDivPerShare = s.divPerShare;
        const divPerPayment = annualDivPerShare / s.divMonths.length;
        const annualDivPre = shares * annualDivPerShare * (s.currency === "USD" ? EXCHANGE_RATE : 1);
        const annualDivPost = annualDivPre * (1 - taxRate);

        s.divMonths.forEach(m => {
            const divThisMonth = shares * divPerPayment * (s.currency === "USD" ? EXCHANGE_RATE : 1);
            monthlyDiv[m - 1] += applyTax ? divThisMonth * (1 - taxRate) : divThisMonth;
            monthlyStocks[m - 1].push(s.currency === "USD" ? s.ticker : s.name);
        });

        return {
            stock: s,
            investKRW: actualInvest,
            shares,
            divPerShare: annualDivPerShare,
            annualDivPre,
            annualDivPost,
            divMonthsLabel: s.divMonths.map(m => monthNames[m - 1]).join(", "),
        };
    });

    const totalInvest = rows.reduce((s, r) => s + r.investKRW, 0);
    const totalAnnualPre = rows.reduce((s, r) => s + r.annualDivPre, 0);
    const totalAnnualPost = rows.reduce((s, r) => s + r.annualDivPost, 0);
    const displayAnnual = applyTax ? totalAnnualPost : totalAnnualPre;
    const portYield = totalInvest > 0 ? (displayAnnual / totalInvest * 100) : 0;

    document.getElementById("sim-results").style.display = "block";
    document.getElementById("sim-total-invest").textContent = Math.round(totalInvest).toLocaleString() + "원";
    document.getElementById("sim-annual-div").textContent = Math.round(displayAnnual).toLocaleString() + "원";
    document.getElementById("sim-monthly-div").textContent = Math.round(displayAnnual / 12).toLocaleString() + "원";
    document.getElementById("sim-port-yield").textContent = portYield.toFixed(2) + "%";

    const tbody = document.querySelector("#table-sim tbody");
    tbody.innerHTML = rows.map(r => `
        <tr>
            <td>${r.stock.currency === "USD" ? r.stock.ticker : r.stock.name} ${r.stock.currency === "USD" ? "🇺🇸" : "🇰🇷"}</td>
            <td>${Math.round(r.investKRW).toLocaleString()}원</td>
            <td>${r.shares.toLocaleString()}주</td>
            <td>${r.stock.currency === "USD" ? "$" + r.divPerShare.toFixed(2) : r.divPerShare.toLocaleString() + "원"}</td>
            <td>${Math.round(r.annualDivPre).toLocaleString()}원</td>
            <td>${Math.round(r.annualDivPost).toLocaleString()}원</td>
            <td>${r.divMonthsLabel}</td>
        </tr>
    `).join("");

    const calendarEl = document.getElementById("sim-calendar");
    calendarEl.innerHTML = monthNames.map((name, i) => {
        const hasDiv = monthlyDiv[i] > 0;
        const stocks = monthlyStocks[i];
        return `
            <div class="cal-month ${hasDiv ? "has-div" : ""}">
                <div class="month-label">${name}</div>
                <div class="month-amount">${hasDiv ? Math.round(monthlyDiv[i]).toLocaleString() + "원" : "-"}</div>
                ${hasDiv ? `<div class="month-stocks">${stocks.join(", ")}</div>` : ""}
            </div>
        `;
    }).join("");

    renderGrowthChart(rows, applyTax, taxRate);
}

function renderGrowthChart(rows, applyTax, taxRate) {
    const canvas = document.getElementById("canvas-growth");
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const years = 10;
    const data = [];
    for (let y = 0; y <= years; y++) {
        let totalDiv = 0;
        rows.forEach(r => {
            const growthRate = r.stock.divGrowth5Y / 100;
            const futureDiv = r.annualDivPre * Math.pow(1 + growthRate, y);
            totalDiv += applyTax ? futureDiv * (1 - taxRate) : futureDiv;
        });
        data.push({ year: y, div: totalDiv });
    }

    const maxDiv = Math.max(...data.map(d => d.div));
    const padL = 80, padR = 30, padT = 20, padB = 40;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    // grid
    ctx.strokeStyle = "#2e3347";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
        const y = padT + (chartH / 4) * i;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
        ctx.fillStyle = "#8b8fa3";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "right";
        const val = maxDiv - (maxDiv / 4) * i;
        ctx.fillText(Math.round(val).toLocaleString() + "원", padL - 8, y + 4);
    }

    // bars + line
    const barW = chartW / (years + 1) * 0.6;
    const gap = chartW / (years + 1);

    data.forEach((d, i) => {
        const x = padL + gap * i + (gap - barW) / 2;
        const h = (d.div / maxDiv) * chartH;
        const y = padT + chartH - h;

        const grad = ctx.createLinearGradient(x, y, x, padT + chartH);
        grad.addColorStop(0, i === 0 ? "#6c5ce7" : "#00b894");
        grad.addColorStop(1, i === 0 ? "rgba(108,92,231,0.3)" : "rgba(0,184,148,0.3)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, [3, 3, 0, 0]);
        ctx.fill();

        ctx.fillStyle = "#e4e6f0";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(Math.round(d.div / 10000) + "만", x + barW / 2, y - 6);

        ctx.fillStyle = "#8b8fa3";
        ctx.font = "10px sans-serif";
        ctx.fillText(i === 0 ? "현재" : i + "년후", x + barW / 2, H - padB + 16);
    });

    // growth label
    if (data.length > 1) {
        const totalGrowth = ((data[years].div / data[0].div - 1) * 100).toFixed(0);
        ctx.fillStyle = "#fdcb6e";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`10년 후 배당 +${totalGrowth}% 성장`, W - padR, padT + 12);
    }
}

function render() {
    const usFiltered = renderTable(US_STOCKS, "us", "table-us");
    const krFiltered = renderTable(KR_STOCKS, "kr", "table-kr");
    updateStats(filterData(US_STOCKS), filterData(KR_STOCKS));
    if (currentTab === "compare") {
        renderCompare(filterData(US_STOCKS), filterData(KR_STOCKS));
    }
    if (currentTab === "etf") {
        renderETFTable(US_ETFS, "table-etf-us");
        renderETFTable(KR_ETFS, "table-etf-kr");
    }
}
