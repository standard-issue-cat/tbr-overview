
/* =========================================
   CONFIGURATION
========================================= */

// CSV column names

const COLUMN_AUTHOR = "Authors";
const COLUMN_TITLE = "Title";
const COLUMN_RATING = "Star Rating";
const COLUMN_STATUS = "Read Status";
const COLUMN_TAGS = "Tags";

// Book statuses

const TBR_STATUSES = [
    "to read",
    "to-read",
    "want to read",
    "want-to-read",
    "tbr",
    "unread"
];

const READ_STATUSES = [
    "read"
];


/* =========================================
   GLOBAL DATA
========================================= */

let allBooks = [];
let authorData = {};
let selectedAuthor = null;


/* =========================================
   HTML ESCAPING
========================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================
   CSV UPLOAD
========================================= */

document
    .getElementById("csvFile")
    .addEventListener("change", handleUpload);


function handleUpload(event) {

    const file = event.target.files[0];

    if (!file) return;

    document.getElementById("status").innerText =
        "Loading CSV...";

    Papa.parse(file, {

        header: true,
        skipEmptyLines: true,
        transformHeader: header => header.trim(),

        complete: function(results) {

            if (results.errors.length > 0) {
                console.warn("CSV parsing warnings:", results.errors);
            }

            try {
                processBooks(results.data);
            } catch (error) {
                console.error(error);

                document.getElementById("status").innerText =
                    "Error: " + error.message;
            }

        },

        error: function(error) {

            document.getElementById("status").innerText =
                error.message;

        }

    });

}


/* =========================================
   NORMALIZE AUTHORS
========================================= */

function normalizeAuthors(authorString) {

    const authors = String(authorString || "")
        .split(",")
        .map(a => a.trim())
        .filter(Boolean);

    return [...new Set(authors)].join(", ");

}


/* =========================================
   NORMALIZE STATUS
========================================= */

function normalizeStatus(status) {

    return String(status || "")
        .trim()
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\s+/g, " ");

}


function isRead(book) {

    return READ_STATUSES.includes(
        normalizeStatus(book[COLUMN_STATUS])
    );

}


function isTBR(book) {

    return TBR_STATUSES.includes(
        normalizeStatus(book[COLUMN_STATUS])
    );

}


/* =========================================
   NORMALIZE TAGS
========================================= */

function parseTags(tagString) {

    if (!tagString) return [];

    return [...new Set(
        String(tagString)
            .split(/[,;|]/)
            .map(tag => tag.trim())
            .filter(Boolean)
    )];

}


/* =========================================
   PROCESS CSV DATA
========================================= */

function processBooks(data) {

    const requiredColumns = [
        COLUMN_AUTHOR,
        COLUMN_TITLE,
        COLUMN_STATUS
    ];

    const availableColumns = Object.keys(data[0] || {});

    const missing = requiredColumns.filter(
        col => !availableColumns.includes(col)
    );

    if (missing.length > 0) {
        throw new Error(
            "Missing CSV columns: " + missing.join(", ")
        );
    }

    allBooks = data
        .filter(row => row[COLUMN_TITLE] && row[COLUMN_AUTHOR])
        .map(row => ({

            ...row,

            cleanAuthor: normalizeAuthors(row[COLUMN_AUTHOR]),

            cleanTitle: String(row[COLUMN_TITLE]).trim(),

            cleanStatus: normalizeStatus(row[COLUMN_STATUS]),

            rating: parseFloat(
                String(row[COLUMN_RATING] ?? "").replace(",", ".")
            ),

            tags: parseTags(row[COLUMN_TAGS])

        }))
        .filter(book => book.cleanAuthor);

    buildAuthorData();

    updateStatistics();
    renderAuthorTable();
    renderGlobalTagChart();

    const firstAuthor = Object.keys(authorData)
        .filter(author => authorData[author].tbr.length > 0)
        .sort()[0];

    if (firstAuthor) {
        showAuthor(firstAuthor);
    } else {
        document.getElementById("authorDetails")
            .classList.add("hidden");
    }

    const readCount = allBooks.filter(isRead).length;
    const tbrCount = allBooks.filter(isTBR).length;

    document.getElementById("status").innerText =
        `${allBooks.length} books loaded | ${readCount} read | ${tbrCount} on TBR`;

}


/* =========================================
   BUILD AUTHOR DATA
========================================= */

function buildAuthorData() {

    authorData = {};

    allBooks.forEach(book => {

        const author = book.cleanAuthor;

        if (!authorData[author]) {

            authorData[author] = {
                read: [],
                tbr: []
            };

        }

        if (isRead(book)) {
            authorData[author].read.push(book);
        }

        if (isTBR(book)) {
            authorData[author].tbr.push(book);
        }

    });

}


/* =========================================
   AUTHOR STATISTICS
========================================= */

function getAverageRating(books) {

    const ratings = books
        .map(book => book.rating)
        .filter(rating =>
            Number.isFinite(rating) &&
            rating >= 0 &&
            rating <= 5
        );

    if (ratings.length === 0) return null;

    return ratings.reduce(
        (sum, rating) => sum + rating, 0
    ) / ratings.length;

}


function getAuthorStats(author) {

    const data = authorData[author];

    const average = getAverageRating(data.read);

    const tags = new Set();

    data.tbr.forEach(book => {
        book.tags.forEach(tag => tags.add(tag));
    });

    return {
        read: data.read.length,
        tbr: data.tbr.length,
        average: average,
        tagCount: tags.size
    };

}


/* =========================================
   DASHBOARD STATISTICS
========================================= */

function updateStatistics() {

    const authors = Object.keys(authorData);

    const readBooks = allBooks.filter(isRead);
    const tbrBooks = allBooks.filter(isTBR);

    document.getElementById("totalAuthors").innerText =
        authors.length;

    document.getElementById("totalRead").innerText =
        readBooks.length;

    document.getElementById("totalTBR").innerText =
        tbrBooks.length;

    const average = getAverageRating(readBooks);

    document.getElementById("averageRating").innerText =
        average === null ? "–" : average.toFixed(2);

}


/* =========================================
   AUTHOR TABLE
========================================= */

document
    .getElementById("authorSearch")
    .addEventListener("input", renderAuthorTable);

document
    .getElementById("authorSort")
    .addEventListener("change", renderAuthorTable);


function renderAuthorTable() {

    const tbody = document.getElementById("authorTable");

    const search = document
        .getElementById("authorSearch")
        .value.toLowerCase();

    const sort = document.getElementById("authorSort").value;

    let authors = Object.keys(authorData)
        .map(author => ({
            author: author,
            ...getAuthorStats(author)
        }))
        .filter(item =>
            item.author.toLowerCase().includes(search)
        );

    if (sort === "tbr") {
        authors.sort((a, b) =>
            b.tbr - a.tbr || a.author.localeCompare(b.author)
        );
    }

    else if (sort === "read") {
        authors.sort((a, b) =>
            b.read - a.read || a.author.localeCompare(b.author)
        );
    }

    else if (sort === "rating") {
        authors.sort((a, b) =>
            (b.average ?? -1) - (a.average ?? -1)
        );
    }

    else {
        authors.sort((a, b) =>
            a.author.localeCompare(b.author)
        );
    }

    tbody.innerHTML = "";

    if (authors.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-message">
                    No authors found.
                </td>
            </tr>
        `;
        return;
    }

    authors.forEach(item => {

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>
                <button class="author-button">
                    ${escapeHTML(item.author)}
                </button>
            </td>
            <td>${item.read}</td>
            <td>
                ${item.average === null
                    ? "–"
                    : item.average.toFixed(2)}
            </td>
            <td>${item.tbr}</td>
            <td>${item.tagCount}</td>
        `;

        tr.querySelector("button")
            .addEventListener("click", () => {
                showAuthor(item.author);
            });

        tbody.appendChild(tr);

    });

}


/* =========================================
   SHOW AUTHOR DETAILS
========================================= */


function showAuthor(author) {

    selectedAuthor = author;

    const data = authorData[author];
    const stats = getAuthorStats(author);

    // Update author information

    document.getElementById("selectedAuthor")
        .innerText = author;

    document.getElementById("authorRead")
        .innerText = stats.read;

    document.getElementById("authorTBR")
        .innerText = stats.tbr;

    document.getElementById("authorRating")
        .innerText = stats.average === null
            ? "–"
            : stats.average.toFixed(2);

    // Update charts and tables

    renderRatingChart(data.read);
    renderTBRTable(data.tbr);
    renderAuthorTags(data.tbr);

    // Open modal

    document.getElementById("authorModal")
        .classList.remove("hidden");

    document.body.classList.add("modal-open");

}



/* =========================================
   RATING CHART
========================================= */

function renderRatingChart(books) {

    const validBooks = books
        .filter(book =>
            Number.isFinite(book.rating) &&
            book.rating >= 0 &&
            book.rating <= 5
        )
        .slice()
        .sort((a, b) =>
            a.cleanTitle.localeCompare(b.cleanTitle)
        );

    if (validBooks.length === 0) {

        document.getElementById("ratingChart")
            .innerHTML =
            '<div class="empty-message">No rated books yet.</div>';

        return;

    }

    const trace = {

        type: "bar",

        x: validBooks.map(book => book.cleanTitle),

        y: validBooks.map(book => book.rating),

        marker: {
            color: validBooks.map(book => book.rating),
            colorscale: [
                [0, "#2b7fb6"],
                [0.5, "#66bf73"],
                [0.75, "#fcd94a"],
                [1, "#e51b1b"]
            ],
            cmin: 0,
            cmax: 5
        },

        hovertemplate:
            "<b>%{x}</b><br>" +
            "Rating: %{y:.2f}<br>" +
            "<extra></extra>"

    };

    Plotly.newPlot(

        "ratingChart",

        [trace],

        {

            paper_bgcolor: "#1c1c1c",
            plot_bgcolor: "#1c1c1c",

            font: {
                color: "#eee"
            },

            yaxis: {
                title: "Rating",
                range: [0, 5],
                dtick: 0.5,
                gridcolor: "#333"
            },

            xaxis: {
                title: "Book",
                tickangle: -45,
                automargin: true
            },

            margin: {
                l: 55,
                r: 20,
                t: 20,
                b: 130
            },

            height: 400

        },

        {
            responsive: true,
            displayModeBar: false
        }

    );

}


/* =========================================
   TBR TABLE
========================================= */

function renderTBRTable(books) {

    const tbody = document.getElementById("tbrTable");

    tbody.innerHTML = "";

    if (books.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="empty-message">
                    No books on the TBR list for this author.
                </td>
            </tr>
        `;

        return;

    }

    const sortedBooks = [...books].sort(
        (a, b) => a.cleanTitle.localeCompare(b.cleanTitle)
    );

    sortedBooks.forEach(book => {

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${escapeHTML(book.cleanTitle)}</td>
            <td>${escapeHTML(book.cleanStatus)}</td>
            <td>
                ${book.tags.length
                    ? book.tags.map(tag =>
                        `<span class="tag">${escapeHTML(tag)}</span>`
                    ).join(" ")
                    : "–"}
            </td>
        `;

        tbody.appendChild(tr);

    });

}


/* =========================================
   AUTHOR TAGS
========================================= */

function renderAuthorTags(books) {

    const container = document.getElementById("authorTags");

    container.innerHTML = "";

    const counts = {};

    books.forEach(book => {

        book.tags.forEach(tag => {
            counts[tag] = (counts[tag] || 0) + 1;
        });

    });

    const sortedTags = Object.entries(counts)
        .sort((a, b) =>
            b[1] - a[1] || a[0].localeCompare(b[0])
        );

    if (sortedTags.length === 0) {

        container.innerHTML =
            '<span class="empty-message">No tags available.</span>';

        return;

    }

    sortedTags.forEach(([tag, count]) => {

        const element = document.createElement("span");

        element.className = "tag";

        element.innerHTML = `
            ${escapeHTML(tag)}
            <span class="tag-count">${count}</span>
        `;

        container.appendChild(element);

    });

}


/* =========================================
   GLOBAL TAG CHART
========================================= */

/* =========================================
   GLOBAL TAG CHART
========================================= */

function renderGlobalTagChart() {

    const counts = {};

    allBooks
        .filter(isTBR)
        .forEach(book => {

            book.tags.forEach(tag => {
                counts[tag] = (counts[tag] || 0) + 1;
            });

        });

    const sortedTags = Object.entries(counts)
        .sort((a, b) =>
            b[1] - a[1] || a[0].localeCompare(b[0])
        )
        .slice(0, 20);

    if (sortedTags.length === 0) {

        document.getElementById("tagChart")
            .innerHTML =
            '<div class="empty-message">No tags found in your TBR pile.</div>';

        document.getElementById("tagBookList").innerHTML = "";

        return;

    }

    const trace = {

        type: "bar",

        orientation: "h",

        x: sortedTags.map(item => item[1]),

        y: sortedTags.map(item => item[0]),

        marker: {
            color: "#e51b1b"
        },

        hovertemplate:
            "%{y}<br>" +
            "Books: %{x}" +
            "<extra></extra>"

    };

    Plotly.newPlot(

        "tagChart",

        [trace],

        {

            paper_bgcolor: "#1c1c1c",
            plot_bgcolor: "#1c1c1c",

            font: {
                color: "#eee"
            },

            xaxis: {
                title: "Number of books",
                gridcolor: "#333",
                dtick: 1
            },

            yaxis: {
                autorange: "reversed",
                automargin: true
            },

            margin: {
                l: 150,
                r: 30,
                t: 15,
                b: 50
            },

            height: Math.max(
                300,
                sortedTags.length * 32
            )

        },

        {
            responsive: true,
            displayModeBar: false
        }

    ).then(chart => {

        // Handle clicks on individual bars.
        chart.on("plotly_click", function(event) {

            const clickedTag = event.points[0].y;

            showBooksWithTag(clickedTag);

        });

    });

}


/* =========================================
   SHOW TBR BOOKS WITH SELECTED TAG
========================================= */

function showBooksWithTag(tag) {

    const matchingBooks = allBooks
        .filter(book =>
            isTBR(book) &&
            book.tags.includes(tag)
        )
        .sort((a, b) =>
            a.cleanTitle.localeCompare(b.cleanTitle)
        );

    const container = document.getElementById("tagBookList");

    container.innerHTML = `
        <h3>Books tagged: ${escapeHTML(tag)}</h3>
        <p class="stat-label">
            ${matchingBooks.length} books
        </p>
    `;

    if (matchingBooks.length === 0) {

        container.innerHTML +=
            '<p class="empty-message">No books found.</p>';

        return;

    }

    const list = document.createElement("ul");

    matchingBooks.forEach(book => {

        const item = document.createElement("li");

        item.innerHTML = `
            <strong>${escapeHTML(book.cleanTitle)}</strong>
            <span class="book-author">
                ${escapeHTML(book.cleanAuthor)}
            </span>
        `;

        list.appendChild(item);

    });

    container.appendChild(list);

}


/* =========================================
   AUTHOR MODAL CONTROLS
========================================= */

const authorModal = document.getElementById("authorModal");


// Close button

document
    .getElementById("closeModal")
    .addEventListener("click", closeAuthorModal);


// Click outside popup

authorModal.addEventListener("click", function(event) {

    if (event.target === authorModal) {
        closeAuthorModal();
    }

});


// Escape key

document.addEventListener("keydown", function(event) {

    if (
        event.key === "Escape" &&
        !authorModal.classList.contains("hidden")
    ) {
        closeAuthorModal();
    }

});


function closeAuthorModal() {

    authorModal.classList.add("hidden");

    document.body.classList.remove("modal-open");

}
