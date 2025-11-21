const isWebsite = typeof fromWebsite !== 'undefined'
var urlNotebookFromWebsite
var urlNotebookFinal

var grid
var gridTrash
const cells = []

function getElementByXpath(path, doc) {
	return doc.evaluate(path, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
}


class Cell {
	constructor(el) {
		this.el = el
		this.dom = new DOMParser().parseFromString(el.outerHTML, 'text/html')
		this.echartsEl = getElementByXpath("//script[contains(text(),'function(echarts)')]/..", this.dom)
		this.markdownEl = getElementByXpath("//div[contains(@class, 'jp-MarkdownOutput')]", this.dom)
		this.plotlyEl = getElementByXpath("//div[contains(@class, 'plotly-graph-div')]/../../../..", this.dom)
		this.vegaEl = getElementByXpath("//div[contains(@id, 'altair-viz-')]/..", this.dom)
		this.bokehEl = getElementByXpath("//script[contains(text(), 'root.Bokeh.embed')]/../../..//div[@data-root-id]", this.dom)
	}


	hasOutput() {
		return !(getElementByXpath("//*[contains(@class, 'jp-mod-noOutputs')]", this.dom))
	}

	echarts() {
		const mainDiv = this.el.querySelector('div[id]')
		mainDiv.setAttribute("style", "width:100%; height:100%;")
		mainDiv.setAttribute('resize-type', 'echarts')
		const loaderHTML = `
      <div class="loader-container-small">
        <div class="loader"></div>
      </div>
    `
		mainDiv.innerHTML = loaderHTML + mainDiv.innerHTML
		return mainDiv.parentElement.innerHTML
	}

	markdown() {
		const newDiv = document.createElement('div')
		newDiv.classList.add('default-cell')
		newDiv.innerHTML = this.el.querySelectorAll('.jp-MarkdownOutput')[0].innerHTML
		return newDiv.outerHTML
	}

	plotly() {
		const mainDiv = this.el.querySelector('div.plotly-graph-div')
		mainDiv.setAttribute("style", "width:100%; height:100%;")
		mainDiv.setAttribute('resize-type', 'plotly')
		return mainDiv.parentElement.outerHTML
	}

	vega() {
		this.vegaEl.querySelectorAll("div")[0].setAttribute('resize-type', 'vega')
		const newDiv = document.createElement('div')
		newDiv.append(this.vegaEl.querySelectorAll("div")[0])
		newDiv.append(this.vegaEl.querySelectorAll("script")[0])
		return newDiv.innerHTML
	}

	bokeh() {
		var bokehScript
		var bokehScriptContent
		var scripts = this.el.getElementsByTagName('script')
		for (var i = 0; i < scripts.length; i++) {
			var script = scripts[i];
			if (script.textContent.indexOf('root.Bokeh.embed') !== -1) {
				bokehScript = script
			}
		}
		var lines = bokehScript.textContent.split("\n")
		let dataJson
		let newDiv
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].includes('const docs_json =')) {
				dataJson = lines[i]
			}
		}
		if (dataJson) {
			dataJson = dataJson.substring(dataJson.indexOf('{'), dataJson.lastIndexOf(';'))
			let dataBokeh = JSON.parse(dataJson)
			let dataBokehRoots = dataBokeh[Object.keys(dataBokeh)[0]]['roots']
			for (let i = 0; i < dataBokehRoots.length; i++) {
				dataBokehRoots[i]["attributes"]["sizing_mode"] = "stretch_both"
			}
			bokehScriptContent = bokehScript.textContent.replace(dataJson, JSON.stringify(dataBokeh))
			let renderJson
			for (let i = 0; i < lines.length; i++) {
				if (lines[i].includes('const render_items =')) {
					renderJson = lines[i]
				}
			}
			renderJson = renderJson.substring(renderJson.indexOf('['), renderJson.lastIndexOf(';'))
			let renderBokeh = JSON.parse(renderJson)
			let renderId = Object.keys(renderBokeh[0]['roots'])[0]
			let divId = renderBokeh[0]['roots'][renderId]
			bokehScriptContent = bokehScriptContent.replace('if (attempts > 100)', 'if (attempts > 1000)')
			bokehScript.textContent = bokehScriptContent
			newDiv = document.createElement('div')
			newDiv.setAttribute('data-root-id', renderId)
			newDiv.setAttribute('id', divId)
			newDiv.style.display = 'contents'
		} else {
			newDiv = this.el.cloneNode(true)
		}
		return newDiv.outerHTML
	}

	default () {
		const newDiv = document.createElement('div')
		newDiv.classList.add('default-cell')
		newDiv.appendChild(this.el.cloneNode(true))
		return newDiv.outerHTML
	}

	get extractFunction() {
		var result
		switch (true) {
			case this.echartsEl !== null:
				result = this.echarts
				break
			case this.markdownEl !== null:
				result = this.markdown
				break
			case this.plotlyEl !== null:
				result = this.plotly
				break
			case this.vegaEl !== null:
				result = this.vega
				break
			case this.bokehEl !== null:
				result = this.bokeh
				break
			default:
				result = this.default
				break
		}
		return result
	}

	pipeline() {
		if (!this.hasOutput()) {
			this.el.remove()
			return
		}
		if (this.markdownEl == null) {

			this.el.querySelectorAll('.jp-Cell-inputWrapper').forEach(el => {
				el.remove()
			})
			this.el.querySelectorAll('.jp-OutputPrompt').forEach(el => {
				el.remove()
			})
		}
		return this.extractFunction()
	}

}

function loadHeadStyles(notebookHtml) {
	const headStyles = Array.from(notebookHtml.head.getElementsByTagName('style'));

	headStyles.forEach(styleElement => {
		const clonedStyleElement = styleElement.cloneNode(true);
		document.head.appendChild(clonedStyleElement);
	});
}

async function loadHeadScripts(notebookHtml) {
	const headContent = notebookHtml.head;
	const scriptElements = Array.from(headContent.getElementsByTagName('script'));

	// Filter out script elements that have a 'src' attribute
	const scriptsWithSrc = scriptElements.filter(script => script.src);

	const scriptsLoaded = new Promise((resolve, reject) => {
		const totalScripts = scriptsWithSrc.length;
		let scriptsLoadedCount = 0;

		// Function to resolve the promise when all scripts have loaded
		function checkAllScriptsLoaded() {
			if (scriptsLoadedCount === totalScripts) {
				resolve();
			}
		}

		scriptsWithSrc.forEach(script => {
			const scriptElement = document.createElement('script');
			scriptElement.src = script.src;

			// Listen for the 'load' event of each script
			scriptElement.onload = () => {
				scriptsLoadedCount++;
				checkAllScriptsLoaded(); // Check if all scripts have loaded
			};

			// Listen for the 'error' event of each script
			scriptElement.onerror = () => {
				reject(new Error(`Failed to load script: ${script.src}`));
			};

			document.head.appendChild(scriptElement);
		});
	});

	// Wait for all scripts with 'src' attribute to load before resolving
	await scriptsLoaded;
}

async function loadScripts(notebookHtml) {
	const bodyScripts = Array.from(notebookHtml.body.getElementsByTagName('script'));

	// Define a recursive function to load scripts sequentially
	async function loadNextScript(index) {
		if (index >= bodyScripts.length) {
			// All scripts have been loaded
			return;
		}

		const currentScript = bodyScripts[index];
		//if (currentScript.textContent.includes("function(Plotly)")) {
		//  return
		//}
		try {
			await loadScript(currentScript);
			// Load the next script recursively
			await loadNextScript(index + 1);
		} catch (error) {
			// If an error occurs, stop loading scripts
			throw error;
		}
	}

	// Start loading scripts recursively from the first one
	await loadNextScript(0);
}


async function loadScript(scriptElement) {
	return new Promise((resolve, reject) => {
		const script = document.createElement('script');
		if (scriptElement.src) {
			script.src = scriptElement.src;
			script.onload = () => {
				resolve();
			};
			script.onerror = (error) => {
				reject(error);
			};
			document.body.appendChild(script);
		} else {
			script.textContent = scriptElement.textContent;
			document.body.appendChild(script);
			resolve();
		}
	});
}


async function start() {
	const notebook = await getNotebook()
	const parser = new DOMParser()
	const notebookHtml = parser.parseFromString(notebook, 'text/html')
	await loadHeadStyles(notebookHtml)
	await loadHeadScripts(notebookHtml)
	const cellsDom = notebookHtml.querySelectorAll('.jp-Cell')
	var id = 0
	for (var i = 0; i < cellsDom.length; i++) {
		var cell = new Cell(cellsDom[i])
		var content = cell.pipeline()
		if (content) {
			cells.push({
				id: id,
				w: 6,
				h: 3,
				content: content
			})
			id = id + 1
		}
	}
	//var result = document.createElement('div');
	//result.classList.add('grid-stack-main')
	//document.body.appendChild(result)


	var gridDef = {
		minRow: 1,
		margin: 5,
		cellHeight: '100px',
		animate: false,
		columnOpts: {
			breakpointForWindow: true,
			breakpoints: [{
				w: 700,
				c: 1
			}]
		}
	}
	var gridTrashDef = {
		margin: 5,
		cellHeight: '70px',
		column: 1,
		disableDrag: true,
		disableResize: true
	}

	addHtml()
	// add callback to render html
	GridStack.renderCB = function(el, widget) {
		el.innerHTML = widget.content;
	};
	grid = GridStack.init(gridDef, '.grid-stack-main')
	gridTrash = GridStack.init(gridTrashDef, '.grid-stack-trash')

	if (typeof savedData !== 'undefined') {
		savedData.forEach(function(item) {
			item.content = cells.find(element => element.id === item.id).content
		})
		grid.load(savedData)
	} else {
		grid.load(cells)
	}

	var trashCells = []
	if (typeof savedData !== 'undefined') {
		trashCells = cells.filter(item => !savedData.some(f => f.id === item.id))
	} else {
		trashCells = []
	}
	gridTrash.load(trashCells)


	loadScripts(notebookHtml)


	window.addEventListener("resize", function(event) {
		if (edit) {
			addGridEditStyle(grid)
		}
	}, true)




	return grid
}

function addGridEditStyle(grid) {
	var currentHeight = grid.opts.cellHeight
	var currentWidth = grid.cellWidth()
	removeGridEditStyle()
	var styles = `
    .grid-stack {
      background-image: linear-gradient(rgba(224, 224, 224, 0.5) 1px, transparent 1px), 
                        linear-gradient(90deg, rgba(224, 224, 224, 0.5) 1px, transparent 0px), 
                        linear-gradient(rgba(255, 255, 255, 0) 5px, transparent 100px), 
                        linear-gradient(90deg, rgba(255, 255, 255, 0) 5px, transparent 100px);                     
      background-size: 100px 100px, calc(8.33% + 0px) 100px, 20px 20px, 20px 20px;                                                            
      background-position: -2px -2px, -1px -2px, -1px -1px, -1px -1px;
    }
  `
	var styleSheet = document.createElement("style")
	styleSheet.setAttribute("id", "gridStyleSheetId")
	styleSheet.innerText = styles
	document.head.appendChild(styleSheet)
	return
}

function trashHasItem() {
	var gridTrash = document.querySelector('.grid-stack-trash')
	var gridItems = gridTrash.querySelectorAll('.grid-stack-item')
	return gridItems.length > 0
}

function removeGridEditStyle() {
	var styleToRemove = document.getElementById("gridStyleSheetId")
	if (styleToRemove) {
		styleToRemove.parentNode.removeChild(styleToRemove)
	}
}

function observeVega(element) {
	resizeVegaObserver.observe(element)
}

function observeEcharts(element) {
	resizeEchartsObserver.observe(element)
}

function observePlotly(element) {
	resizePlotlyObserver.observe(element)
}

let resizeVegaObserver = new ResizeObserver(entries => {
	for (let entry of entries) {
		var vegaEl = entry.target.querySelector('div').querySelector('div')
		var scriptStr = resizeVega(vegaEl)
		eval(scriptStr)
	}
});

let resizeEchartsObserver = new ResizeObserver(entries => {
	for (let entry of entries) {
		var echartsEl = entry.target.querySelector('div').querySelector('div')
		var code = resizeEcharts(echartsEl)
		eval(code)
	}
});

let resizePlotlyObserver = new ResizeObserver(entries => {
	for (let entry of entries) {
		var plotlyEl = entry.target.querySelector('div').querySelector('div')
		var code = resizePlotly(plotlyEl)
		eval(code)
	}
});

function addResizes() {
	var elementsWithResize = document.querySelectorAll('[resize-type]')
	elementsWithResize.forEach(function(el) {
		addResize(el)
	})
}

function addResize(el) {
	var resizeType = el.getAttribute('resize-type')
	switch (resizeType) {
		case "vega":
			observeVega(el.parentElement.parentElement)
			break
		case "echarts":
			observeEcharts(el.parentElement.parentElement)
			break
		case "plotly":
			observePlotly(el.parentElement.parentElement)
			break
		default:
			break
	}
}


function resizeEcharts(echartsEl) {
	var echartsId = echartsEl.getAttribute('id')
	var code = `
        require(['echarts'], function(echarts) {
            
          const container = document.getElementById('${echartsId}');
          const chart = echarts.init(container);
            new ResizeObserver(() => {
                chart.resize()
            }).observe(container)
        })
  `
	return code
}

function resizePlotly(plotlyEl) {
	var plotlyId = plotlyEl.getAttribute('id')
	var gridStackItemContent = plotlyEl.parentElement.parentElement
	var height = gridStackItemContent.offsetHeight
	var width = gridStackItemContent.offsetWidth
	var code = `
        require(['plotly'], function(Plotly) {
	  Plotly.relayout(document.getElementById('${plotlyId}'), {
	    width: ${width},
	    height: ${height}
	  })
        })
    `
	return code
}

function resizeVega(vegaEl) {
	var vegaId = vegaEl.getAttribute('id')
	var scriptStr = vegaEl.nextElementSibling.textContent
	scriptStr = scriptStr.replace(
		'let outputDiv = document.currentScript.previousElementSibling;',
		`let outputDiv = document.getElementById("${vegaId}");`
	)
	const lines = scriptStr.split("\n")
	let linePayload
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].includes('{"mode": "vega-lite"}')) {
			linePayload = lines[i]
		}
	}
	if (linePayload) {
		const payloadStr = linePayload.substring(linePayload.indexOf('{'), linePayload.lastIndexOf(','))
		const payload = JSON.parse(payloadStr)
		payload["width"] = "container"
		payload["height"] = "container"
		scriptStr = scriptStr.replace(payloadStr, JSON.stringify(payload))
		scriptStr = `
            const currentVega = document.getElementById('${vegaId}');
            currentVega.style.width = currentVega.parentElement.clientWidth*0.98 + 'px'
            currentVega.style.height = currentVega.parentElement.clientHeight*0.98 + 'px'
            ${scriptStr}
        `
	}
	return scriptStr
}




async function init() {
	if (isWebsite) {
		urlNotebookFinal = await getUrlNotebookFromWebsite()
	} else {
		if (typeof urlNotebook !== 'undefined') {
			urlNotebookFinal = urlNotebook
		}
	}
	if (!isWebsite || typeof urlNotebookFinal !== "undefined") {
		await saveToIndexedDb()
	}
	grid = await start()
	addResizes()
	addJs()
}

function getUrlNotebookFromWebsite() {
	return new Promise((resolve, reject) => {
		const dbPromise = indexedDB.open('dashboardtify')

		dbPromise.onsuccess = (event) => {
			const database = event.target.result
			const transaction = database.transaction('notebooks', 'readwrite');
			const objectStore = transaction.objectStore('notebooks');

			const request = objectStore.get('url');
			request.onsuccess = (e) => {
				const url = e.target.result
				resolve(url)
			}
		}
	})
}

document.addEventListener('DOMContentLoaded', function() {
	init()
	fetch("https://counter.dashboardtify.com/inc?page=" + document.title)
})



function addEditStyle() {
	addCardEditStyle()
	addGridEditStyle(grid)
	document.querySelector('.grid-stack-main').classList.toggle('margin-bottom-100')
}

function removeEditStyle() {
	removeCardEditStyle()
	removeGridEditStyle()
	document.querySelector('.grid-stack-main').classList.toggle('margin-bottom-100')
}

function addCardEditStyle() {
	var htmlTopRight = ` 
    <div class="top-right">
      <span class="iconify" data-icon="mdi-close-circle-outline" onclick="switchGrid(this.parentElement.parentElement)"></span>
    </div>
  `
	var htmlOverlayCard = ` 
    <div class="overlay-card"></div>
  `
	var gridStackItems = document.querySelectorAll('.grid-stack-item')
	var gridStackItemContents = document.querySelectorAll('.grid-stack-item-content')
	gridStackItems.forEach(function(el) {
		var stringToAdd
		if (el.parentElement.classList.contains('grid-stack-trash')) {
			stringToAdd = htmlTopRight.replace("mdi-close-circle-outline", "mdi-delete-restore")
		} else stringToAdd = htmlTopRight
		el.insertAdjacentHTML('beforeend', stringToAdd)
	})
	gridStackItemContents.forEach(function(el) {
		el.insertAdjacentHTML('beforeend', htmlOverlayCard)
	})
}

function switchGrid(el) {
	var currentGrid
	var nextGrid
	var iconHtml
	el.querySelector('.iconify').remove()
	var topRight = el.querySelector('.top-right')
	var trashBtn = document.getElementById('trashBtn')
	el.setAttribute('gs-x', '0')
	el.setAttribute('gs-y', '0')
	el.setAttribute('gs-w', '6')
	el.setAttribute('gs-h', '3')
	if (el.parentElement.classList.contains('grid-stack-main')) {
		currentGrid = grid
		nextGrid = gridTrash
		iconHtml = '<span class="iconify" data-icon="mdi-delete-restore" onclick="switchGrid(this.parentElement.parentElement)"></span>'
		if (trashBtn.classList.contains('hidden')) {
			trashBtn.classList.toggle('hidden')
		}
	} else {
		currentGrid = gridTrash
		nextGrid = grid
		iconHtml = '<span class="iconify" data-icon="mdi-close-circle-outline" onclick="switchGrid(this.parentElement.parentElement)"></span>'
	}
	topRight.insertAdjacentHTML('beforeend', iconHtml)
	currentGrid.removeWidget(el)
	nextGrid.addWidget(el)
	if (!trashHasItem()) {
		if (!(trashBtn.classList.contains('hidden'))) {
			trashBtn.classList.toggle('hidden')
		}
	}
}

function removeCardEditStyle() {
	document.querySelectorAll('.top-right').forEach(function(element) {
		element.remove()
	})
	document.querySelectorAll('.overlay-card').forEach(function(element) {
		element.remove()
	})
}


async function fetchNotebookHtmlFromUrl() {
	const response = await fetch(urlNotebookFinal)
	const html = await response.text()
	return html
}


async function fetchNotebookIpynbFromUrl() {
	addLoaderIpynbText()
	const response = await fetch(
		'https://nbconvert-api.dashboardtify.com/from-url', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				url: urlNotebookFinal
			})
		}
	)
	const html = await response.text()
	removeLoaderIpynbText()
	return html
}


function addLoaderIpynbText() {
	var newDiv = document.createElement("div")
	newDiv.style.marginTop = "10px"
	newDiv.textContent = "Converting ipynb to html"
	newDiv.id = "loader-text"
	document.getElementById("loader-container").appendChild(newDiv)
}


function removeLoaderIpynbText() {
	var loaderText = document.getElementById("loader-text")
	if (loaderText) {
		loaderText.remove()
	}
}


function fetchNotebookFromScript() {
	const scriptEncodedNotebook = document.getElementById('scriptEncodedNotebook')
	const encodedNotebook = scriptEncodedNotebook.textContent.trim().slice(1, -1)
	const notebook = decodeURIComponent(escape(window.atob(encodedNotebook)))
	return notebook
}


async function fetchNotebook() {
	if (typeof urlNotebookFinal === 'undefined') {
		return fetchNotebookFromScript()
	}
	if (urlNotebookFinal.toLowerCase().endsWith(".ipynb")) {
		return await fetchNotebookIpynbFromUrl()
	}
	return await fetchNotebookHtmlFromUrl()
}


function modifyNotebook(notebook) {
	notebook = addRequireTimeout(notebook)
	return notebook
}

function addRequireTimeout(notebook) {
	const parser = new DOMParser()
	const htmlDocument = parser.parseFromString(notebook, 'text/html')
	const rootElement = htmlDocument.documentElement
	const scripts = htmlDocument.getElementsByTagName('script')
	let isRequireLoaded = false

	for (let script of scripts) {
		if (script.src.includes('require.min.js')) {
			isRequireLoaded = true
			break
		}
	}

	if (isRequireLoaded) {
		const requireConfigScript = htmlDocument.createElement('script');
		requireConfigScript.textContent = `
        require.config({
            waitSeconds: 60
        })
    `
		const body = htmlDocument.getElementsByTagName('body')[0];
		if (body) {
			body.appendChild(requireConfigScript);
		}
	}
	return htmlDocument.documentElement.outerHTML;
}


async function saveToIndexedDb() {
	var notebook = await fetchNotebook()
	notebook = modifyNotebook(notebook)
	const dbPromise = indexedDB.open('dashboardtify')
	dbPromise.onupgradeneeded = (event) => {
		const database = event.target.result
		if (!database.objectStoreNames.contains('notebooks')) {
			database.createObjectStore('notebooks')
		}
	};
	dbPromise.onsuccess = (event) => {
		const database = event.target.result
		const transaction = database.transaction(['notebooks'], 'readwrite')
		const objectStore = transaction.objectStore('notebooks');
		objectStore.put(notebook, 'notebook');
	}
}


function getSavedData() {
	var savedData = grid.save()
	savedData.forEach(object => {
		delete object['content'];
	})
	return savedData
}


async function download() {
	if (isWebsite) {
		fileName = await getFileNameFromIndexedDB()
	}
	const template = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link rel="icon" href="https://www.dashboardtify.com/favicon.svg" type="image/x-icon">
        <title>title</title>
        <link href="https://www.dashboardtify.com/gridstack/gridstack.min.css" rel="stylesheet">
        <script src="https://www.dashboardtify.com/gridstack/gridstack-all.js"></script>
        <script src="https://code.iconify.design/1/1.0.6/iconify.min.js"></script>
        <link href="https://www.dashboardtify.com/1.6/dashboardtify.css" rel="stylesheet">
        <script src="https://www.dashboardtify.com/1.6/dashboardtify.js" defer=""></script>
      </head>
      <body>
        <div id="loader-container" class="loader-container">
          <div id="loader" class="loader"></div>
        </div>
        <script>
          var fileName = '${fileName}'
	  var savedData =  ${JSON.stringify(getSavedData())}
	  var edit = false
        </script>
      </body>
    </html>
  `
	const parser = new DOMParser()
	const templateHTML = parser.parseFromString(template, 'text/html')
	const bodyElement = templateHTML.querySelector('body')
	const scriptElement = document.createElement('script')
	if (typeof urlNotebookFinal !== 'undefined') {
		scriptElement.textContent = `var urlNotebook = "${urlNotebookFinal}"`
	} else {
		var encodedNotebook
		if (isWebsite) {
			encodedNotebook = await getEncodedNotebook()
		} else {
			const scriptEncodedNotebook = document.getElementById('scriptEncodedNotebook')
			encodedNotebook = scriptEncodedNotebook.textContent.trim().slice(1, -1)
		}
		scriptElement.id = 'scriptEncodedNotebook'
		scriptElement.textContent = `"${encodedNotebook}"`
	}
	templateHTML.title = fileName + ' dashboardtify'
	bodyElement.appendChild(scriptElement)
	var blob = new Blob([templateHTML.documentElement.outerHTML], {
		type: 'text/html'
	})
	var blobUrl = URL.createObjectURL(blob)
	var downloadLink = document.createElement('a')
	downloadLink.href = blobUrl
	downloadLink.download = fileName + '_dashboardtify.html'
	downloadLink.click()
	URL.revokeObjectURL(blobUrl)
}


async function getEncodedNotebook() {
	const notebook = await getNotebook()
	return encodedNotebook = btoa(unescape(encodeURIComponent(notebook)))
}


function populateNotebookIframe() {
	const dbPromise = indexedDB.open('dashboardtify')

	dbPromise.onsuccess = (event) => {
		const database = event.target.result
		const transaction = database.transaction('notebooks', 'readwrite');
		const objectStore = transaction.objectStore('notebooks');

		const request = objectStore.get('notebook');
		request.onsuccess = (e) => {
			const notebook = e.target.result
			var notebookIframe = document.getElementById("notebookIframe")
			notebookIframe.srcdoc = notebook
		}
	}
}


function addHtml() {
	var htmlString = ` 
    <div id="topBar">
      <div id="topBarEdit">
        <div class="app-bar-button">
          <span id="trashBtn"><span class="iconify white-bg" data-icon="mdi-trash-can-outline"></span></span>
        </div>
        <div class="centered">
          <span class="iconify" data-icon="mdi-pencil-outline"></span>
          You're editing this dashboard. 
          <button id="doneBtn" class="white-bg">Done</button>
        </div>
        <div class="app-bar-button">
        </div>
      </div>
      <div id="topBarView">
        <span id="viewDashboardBtn" class="hidden tooltip-container">
          <span class="iconify white-bg" data-icon="mdi-view-dashboard-outline"></span>
	  <span class="tooltip">View Dashboard</span>
        </span>
        <span id="editBtn" class="tooltip-container">
	  <span class="iconify white-bg" data-icon="mdi-pencil-outline"></span>
	  <span class="tooltip">Edit Dashboard</span>
	</span>
        <span id="viewNotebookBtn" class="tooltip-container">
          <span class="iconify white-bg" data-icon="mdi-view-agenda-outline"></span>
	  <span class="tooltip">View Notebook</span>
        </span>
        <span id="downloadBtn" class="tooltip-container">
          <span class="iconify white-bg" data-icon="mdi-download-outline"></span>
	  <span class="tooltip">Download</span>
        </span>
        <span id="closeBtn"><span class="iconify" data-icon="mdi-close-circle-outline"></span></span>
      </div>
    </div>
    <div id="overlay"></div>
    <div id="drawer">
      <div class="grid-stack-trash"></div>
    </div>
    <div id="dashboard-container">
      <div class="grid-stack-main"></div>
    </div>
    <div id="notebookContainer" class="hidden">
      <iframe id="notebookIframe" frameborder="0"></iframe>
    </div>
  `
	removeLoader()
	document.body.insertAdjacentHTML('afterbegin', htmlString)
	addBodyStyle()
}

function getNotebook() {
	return new Promise((resolve, reject) => {
		const dbPromise = indexedDB.open('dashboardtify')

		dbPromise.onsuccess = (event) => {
			const database = event.target.result
			const transaction = database.transaction('notebooks', 'readwrite');
			const objectStore = transaction.objectStore('notebooks');

			const request = objectStore.get('notebook');
			request.onsuccess = (e) => {
				const notebook = e.target.result
				resolve(notebook)
			}
		}
	})
}


function getFileNameFromIndexedDB() {
	return new Promise((resolve, reject) => {
		const dbPromise = indexedDB.open('dashboardtify')

		dbPromise.onsuccess = (event) => {
			const database = event.target.result
			const transaction = database.transaction('notebooks', 'readwrite');
			const objectStore = transaction.objectStore('notebooks');

			const request = objectStore.get('fileName');
			request.onsuccess = (e) => {
				const fileName = e.target.result
				resolve(fileName)
			}
		}
	})
}

function addJs() {
	var trashBtn = document.getElementById('trashBtn');
	var editBtn = document.getElementById('editBtn');
	var doneBtn = document.getElementById('doneBtn');
	var downloadBtn = document.getElementById('downloadBtn');
	var viewNotebookBtn = document.getElementById('viewNotebookBtn');
	var viewDashboardBtn = document.getElementById('viewDashboardBtn');
	var closeBtn = document.getElementById('closeBtn');
	var drawer = document.getElementById('drawer');
	var overlay = document.getElementById('overlay')
	var topBarEdit = document.getElementById('topBarEdit')
	var topBarView = document.getElementById('topBarView')
	var body = document.body


	/*
		if(!trashHasItem()) {
		  trashBtn.classList.toggle('hidden')
		}
	*/
	if (edit) {
		//downloadBtn.style.display = 'none'
		topBarView.classList.toggle('hidden')
		addEditStyle()
		//adjustGridHeight()
	} else {
		grid.disable()
		topBarEdit.classList.toggle('hidden')
		//trashBtn.classList.toggle('hidden')
	}
	if (isWebsite) {
		closeBtn.classList.toggle('hidden')
	}

	trashBtn.addEventListener('click', function() {
		var currentLeft = parseInt(getComputedStyle(drawer).left)

		if (currentLeft < 0) {
			drawer.style.left = '0';
			overlay.style.display = 'block'
			body.classList.add('drawer-open')
		} else {
			drawer.style.left = '-300px';
			overlay.style.display = 'none'
			body.classList.remove('drawer-open')
		}
	});
	doneBtn.addEventListener('click', function() {
		edit = !edit
		removeEditStyle()
		grid.disable()
		topBarView.classList.toggle('hidden')
		topBarEdit.classList.toggle('hidden')
		//trashBtn.classList.toggle('hidden')
	})
	editBtn.addEventListener('click', function() {
		edit = !edit
		addEditStyle()
		grid.enable()
		topBarView.classList.toggle('hidden')
		topBarEdit.classList.toggle('hidden')
		if (trashBtn.classList.contains('hidden') && trashHasItem()) {
			trashBtn.classList.toggle('hidden')
		}
	});
	viewNotebookBtn.addEventListener('click', function() {
		var gridStackMain = document.querySelector('.grid-stack-main')
		var notebookContainer = document.getElementById("notebookContainer")
		var notebookIframe = document.getElementById("notebookIframe")
		if (notebookIframe.srcdoc === '') {
			populateNotebookIframe()
		}
		gridStackMain.classList.toggle('hidden')
		notebookContainer.classList.toggle('hidden')
		editBtn.classList.toggle('hidden')
		viewNotebookBtn.classList.toggle('hidden')
		viewDashboardBtn.classList.toggle('hidden')
	});
	viewDashboardBtn.addEventListener('click', function() {
		var gridStackMain = document.querySelector('.grid-stack-main')
		var notebookContainer = document.getElementById("notebookContainer")
		notebookContainer.classList.toggle('hidden')
		gridStackMain.classList.toggle('hidden')
		editBtn.classList.toggle('hidden')
		viewNotebookBtn.classList.toggle('hidden')
		viewDashboardBtn.classList.toggle('hidden')
	})
	closeBtn.addEventListener('click', function() {
		var appBar = document.getElementById('topBar')
		appBar.classList.toggle('hidden')
		document.body.style.setProperty('margin-top', '0', 'important')
	})
	downloadBtn.addEventListener('click', function() {
		download()
	})

	document.addEventListener('click', function(event) {
		//var drawer = document.getElementById('drawer');
		// Close the drawer if the click is outside the drawer and the drawer is open
		if (event.target !== trashBtn && !drawer.contains(event.target) && parseInt(getComputedStyle(drawer).left) === 0) {
			drawer.style.left = '-300px';
			overlay.style.display = 'none'
			body.classList.remove('drawer-open')
		}
	});
}


function removeLoader() {
	var loaderContainer = document.getElementById("loader-container")
	loaderContainer.parentNode.removeChild(loaderContainer)
}


function addBodyStyle() {
	var style = document.createElement("style")
	style.textContent = `
    body {
      margin-left: 0 !important;
      margin-right: 0 !important;
      margin-bottom: 0 !important;
      margin-top: 60px !important;
      padding: 0 !important;
    }
  `
	document.head.appendChild(style)
}
