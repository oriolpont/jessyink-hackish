// Copyright 2008, 2009 Hannes Hochreiner
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see http://www.gnu.org/licenses/.

// Set onload event handler.
window.onload = jessyInkInit;

// Creating a namespace dictionary. The standard Inkscape namespaces are taken from inkex.py.
var NSS = new Object();
NSS['sodipodi']='http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd';
NSS['cc']='http://web.resource.org/cc/';
NSS['svg']='http://www.w3.org/2000/svg';
NSS['dc']='http://purl.org/dc/elements/1.1/';
NSS['rdf']='http://www.w3.org/1999/02/22-rdf-syntax-ns#';
NSS['inkscape']='http://www.inkscape.org/namespaces/inkscape';
NSS['xlink']='http://www.w3.org/1999/xlink';
NSS['xml']='http://www.w3.org/XML/1998/namespace';
NSS['jessyink']='https://launchpad.net/jessyink';

// Keycodes.
var LEFT_KEY = 37; // cursor left keycode
var UP_KEY = 38; // cursor up keycode
var RIGHT_KEY = 39; // cursor right keycode
var DOWN_KEY = 40; // cursor down keycode
var PAGE_UP_KEY = 33; // page up keycode
var PAGE_DOWN_KEY = 34; // page down keycode
var HOME_KEY = 36; // home keycode
var END_KEY = 35; // end keycode
var ENTER_KEY = 13; // next slide
var SPACE_KEY = 32;
var ESCAPE_KEY = 27;

// Presentation modes.
var SLIDE_MODE = 1;
var INDEX_MODE = 2;
var DRAWING_MODE = 3;

// Mouse handler actions.
var MOUSE_UP = 1;
var MOUSE_DOWN = 2;
var MOUSE_MOVE = 3;
var MOUSE_WHEEL = 4;

// Parameters.
var ROOT_NODE = document.getElementsByTagNameNS(NSS[&quot;svg&quot;], &quot;svg&quot;)[0];
var HEIGHT = 0;
var WIDTH = 0;
var INDEX_COLUMNS_DEFAULT = 4;
var INDEX_COLUMNS = INDEX_COLUMNS_DEFAULT;
var INDEX_OFFSET = 0;
var STATE_START = -1;
var STATE_END = -2;
var BACKGROUND_COLOR = null;
var slides = new Array();

// Initialisation.
var currentMode = SLIDE_MODE;
var masterSlide = null;
var activeSlide = 0;
var activeEffect = 0;
var timeStep = 30; // 40 ms equal 25 frames per second.
var lastFrameTime = null;
var processingEffect = false;
var transCounter = 0;
var effectArray = 0;
var defaultTransitionInDict = new Object();
defaultTransitionInDict[&quot;name&quot;] = &quot;appear&quot;;
var defaultTransitionOutDict = new Object();
defaultTransitionOutDict[&quot;name&quot;] = &quot;appear&quot;;
var jessyInkInitialised = false;

// Initialise char and key code dictionaries.
var charCodeDictionary = getDefaultCharCodeDictionary();
var keyCodeDictionary = getDefaultKeyCodeDictionary();

// Initialise mouse handler dictionary.
var mouseHandlerDictionary = getDefaultMouseHandlerDictionary();

var progress_bar_visible = false;
var timer_elapsed = 0;
var timer_start = timer_elapsed;
var timer_duration = 15; // 15 minutes

var history_counter = 0;
var history_original_elements = new Array();
var history_presentation_elements = new Array();

var mouse_original_path = null;
var mouse_presentation_path = null;
var mouse_last_x = -1;
var mouse_last_y = -1;
var mouse_min_dist_sqr = 3 * 3;
var path_colour = &quot;red&quot;;
var path_width_default = 3;
var path_width = path_width_default;
var path_paint_width = path_width;

var number_of_added_slides = 0;

/** Initialisation function.
 *  The whole presentation is set-up in this function.
 */
function jessyInkInit()
{
	// Make sure we only execute this code once. Double execution can occur if the onload event handler is set
	// in the main svg tag as well (as was recommended in earlier versions). Executing this function twice does
	// not lead to any problems, but it takes more time.
	if (jessyInkInitialised)
		return;

	// Making the presentation scaleable.
	var VIEWBOX = ROOT_NODE.getAttribute(&quot;viewBox&quot;);

	if (VIEWBOX)
	{
		WIDTH = ROOT_NODE.viewBox.animVal.width;
		HEIGHT = ROOT_NODE.viewBox.animVal.height;
	}
	else
	{
		HEIGHT = parseFloat(ROOT_NODE.getAttribute(&quot;height&quot;));
		WIDTH = parseFloat(ROOT_NODE.getAttribute(&quot;width&quot;));
		ROOT_NODE.setAttribute(&quot;viewBox&quot;, &quot;0 0 &quot; + WIDTH + &quot; &quot; + HEIGHT);
	}

	ROOT_NODE.setAttribute(&quot;width&quot;, &quot;100%&quot;);
	ROOT_NODE.setAttribute(&quot;height&quot;, &quot;100%&quot;);

	// Setting the background color.
	var namedViews = document.getElementsByTagNameNS(NSS[&quot;sodipodi&quot;], &quot;namedview&quot;);

	for (var counter = 0; counter &lt; namedViews.length; counter++)
	{
		if (namedViews[counter].hasAttribute(&quot;id&quot;) &amp;&amp; namedViews[counter].hasAttribute(&quot;pagecolor&quot;))
		{
			if (namedViews[counter].getAttribute(&quot;id&quot;) == &quot;base&quot;)
			{
				BACKGROUND_COLOR = namedViews[counter].getAttribute(&quot;pagecolor&quot;);
				var newAttribute = &quot;background-color:&quot; + BACKGROUND_COLOR + &quot;;&quot;;

				if (ROOT_NODE.hasAttribute(&quot;style&quot;))
					newAttribute += ROOT_NODE.getAttribute(&quot;style&quot;);

				ROOT_NODE.setAttribute(&quot;style&quot;, newAttribute);
			}
		}
	}

	// Defining clip-path.
	var defsNodes = document.getElementsByTagNameNS(NSS[&quot;svg&quot;], &quot;defs&quot;);

	if (defsNodes.length &gt; 0)
	{
		var existingClipPath = document.getElementById(&quot;jessyInkSlideClipPath&quot;);

		if (!existingClipPath)
		{
			var rectNode = document.createElementNS(NSS[&quot;svg&quot;], &quot;rect&quot;);
			var clipPath = document.createElementNS(NSS[&quot;svg&quot;], &quot;clipPath&quot;);

			rectNode.setAttribute(&quot;x&quot;, 0);
			rectNode.setAttribute(&quot;y&quot;, 0);
			rectNode.setAttribute(&quot;width&quot;, WIDTH);
			rectNode.setAttribute(&quot;height&quot;, HEIGHT);

			clipPath.setAttribute(&quot;id&quot;, &quot;jessyInkSlideClipPath&quot;);
			clipPath.setAttribute(&quot;clipPathUnits&quot;, &quot;userSpaceOnUse&quot;);

			clipPath.appendChild(rectNode);
			defsNodes[0].appendChild(clipPath);
		}
	}

	// Making a list of the slide and finding the master slide.
	var nodes = document.getElementsByTagNameNS(NSS[&quot;svg&quot;], &quot;g&quot;);
	var tempSlides = new Array();
	var existingJessyInkPresentationLayer = null;

	for (var counter = 0; counter &lt; nodes.length; counter++)
	{
		if (nodes[counter].getAttributeNS(NSS[&quot;inkscape&quot;], &quot;groupmode&quot;) &amp;&amp; (nodes[counter].getAttributeNS(NSS[&quot;inkscape&quot;], &quot;groupmode&quot;) == &quot;layer&quot;))
		{
			if (nodes[counter].getAttributeNS(NSS[&quot;inkscape&quot;], &quot;label&quot;) &amp;&amp; nodes[counter].getAttributeNS(NSS[&quot;jessyink&quot;], &quot;masterSlide&quot;) == &quot;masterSlide&quot;)
				masterSlide = nodes[counter];
			else if (nodes[counter].getAttributeNS(NSS[&quot;inkscape&quot;], &quot;label&quot;) &amp;&amp; nodes[counter].getAttributeNS(NSS[&quot;jessyink&quot;], &quot;presentationLayer&quot;) == &quot;presentationLayer&quot;)
				existingJessyInkPresentationLayer = nodes[counter];
			else
				tempSlides.push(nodes[counter].getAttribute(&quot;id&quot;));
		}
		else if (nodes[counter].getAttributeNS(NSS['jessyink'], 'element'))
		{
			handleElement(nodes[counter]);
		}
	}

	// Hide master slide set default transitions.
	if (masterSlide)
	{
		masterSlide.style.display = &quot;none&quot;;

		if (masterSlide.hasAttributeNS(NSS[&quot;jessyink&quot;], &quot;transitionIn&quot;))
			defaultTransitionInDict = propStrToDict(masterSlide.getAttributeNS(NSS[&quot;jessyink&quot;], &quot;transitionIn&quot;));

		if (masterSlide.hasAttributeNS(NSS[&quot;jessyink&quot;], &quot;transitionOut&quot;))
			defaultTransitionOutDict = propStrToDict(masterSlide.getAttributeNS(NSS[&quot;jessyink&quot;], &quot;transitionOut&quot;));
	}

	if (existingJessyInkPresentationLayer != null)
	{
		existingJessyInkPresentationLayer.parentNode.removeChild(existingJessyInkPresentationLayer);
	}

	// Set start slide.
	var hashObj = new LocationHash(window.location.hash);

	activeSlide = hashObj.slideNumber;
	activeEffect = hashObj.effectNumber;

	if (activeSlide &lt; 0)
		activeSlide = 0;
	else if (activeSlide &gt;= tempSlides.length)
		activeSlide = tempSlides.length - 1;

	var originalNode = document.getElementById(tempSlides[counter]);

	var JessyInkPresentationLayer = document.createElementNS(NSS[&quot;svg&quot;], &quot;g&quot;);
	JessyInkPresentationLayer.setAttributeNS(NSS[&quot;inkscape&quot;], &quot;groupmode&quot;, &quot;layer&quot;);
	JessyInkPresentationLayer.setAttributeNS(NSS[&quot;inkscape&quot;], &quot;label&quot;, &quot;JessyInk Presentation Layer&quot;);
	JessyInkPresentationLayer.setAttributeNS(NSS[&quot;jessyink&quot;], &quot;presentationLayer&quot;, &quot;presentationLayer&quot;);
	JessyInkPresentationLayer.setAttribute(&quot;id&quot;, &quot;jessyink_presentation_layer&quot;);
	JessyInkPresentationLayer.style.display = &quot;inherit&quot;;
	ROOT_NODE.appendChild(JessyInkPresentationLayer);

	// Gathering all the information about the transitions and effects of the slides, set the background
	// from the master slide and substitute the auto-texts.
	for (var counter = 0; counter &lt; tempSlides.length; counter++)
	{
		var originalNode = document.getElementById(tempSlides[counter]);
		originalNode.style.display = &quot;none&quot;;
		var node = suffixNodeIds(originalNode.cloneNode(true), &quot;_&quot; + counter);
		JessyInkPresentationLayer.appendChild(node);
		slides[counter] = new Object();
		slides[counter][&quot;original_element&quot;] = originalNode;
		slides[counter][&quot;element&quot;] = node;

		// Set build in transition.
		slides[counter][&quot;transitionIn&quot;] = new Object();

		var dict;

		if (node.hasAttributeNS(NSS[&quot;jessyink&quot;], &quot;transitionIn&quot;))
			dict = propStrToDict(node.getAttributeNS(NSS[&quot;jessyink&quot;], &quot;transitionIn&quot;));
		else
			dict = defaultTransitionInDict;

		slides[counter][&quot;transitionIn&quot;][&quot;name&quot;] = dict[&quot;name&quot;];
		slides[counter][&quot;transitionIn&quot;][&quot;options&quot;] = new Object();

		for (key in dict)
			if (key != &quot;name&quot;)
				slides[counter][&quot;transitionIn&quot;][&quot;options&quot;][key] = dict[key];

		// Set build out transition.
		slides[counter][&quot;transitionOut&quot;] = new Object();

		if (node.hasAttributeNS(NSS[&quot;jessyink&quot;], &quot;transitionOut&quot;))
			dict = propStrToDict(node.getAttributeNS(NSS[&quot;jessyink&quot;], &quot;transitionOut&quot;));
		else
			dict = defaultTransitionOutDict;

		slides[counter][&quot;transitionOut&quot;][&quot;name&quot;] = dict[&quot;name&quot;];
		slides[counter][&quot;transitionOut&quot;][&quot;options&quot;] = new Object();

		for (key in dict)
			if (key != &quot;name&quot;)
				slides[counter][&quot;transitionOut&quot;][&quot;options&quot;][key] = dict[key];

		// Copy master slide content.
		if (masterSlide)
		{
			var clonedNode = suffixNodeIds(masterSlide.cloneNode(true), &quot;_&quot; + counter);
			clonedNode.removeAttributeNS(NSS[&quot;inkscape&quot;], &quot;groupmode&quot;);
			clonedNode.removeAttributeNS(NSS[&quot;inkscape&quot;], &quot;label&quot;);
			clonedNode.style.display = &quot;inherit&quot;;

			node.insertBefore(clonedNode, node.firstChild);
		}

		// Setting clip path.
		node.setAttribute(&quot;clip-path&quot;, &quot;url(#jessyInkSlideClipPath)&quot;);

		// Substitute auto texts.
		substituteAutoTexts(node, node.getAttributeNS(NSS[&quot;inkscape&quot;], &quot;label&quot;), counter + 1, tempSlides.length);

		node.removeAttributeNS(NSS[&quot;inkscape&quot;], &quot;groupmode&quot;);
		node.removeAttributeNS(NSS[&quot;inkscape&quot;], &quot;label&quot;);

		// Set effects.
		var tempEffects = new Array();
		var groups = new Object();

		for (var IOCounter = 0; IOCounter &lt;= 1; IOCounter++)
		{
			var propName = &quot;&quot;;
			var dir = 0;

			if (IOCounter == 0)
			{
				propName = &quot;effectIn&quot;;
				dir = 1;
			}
			else if (IOCounter == 1)
			{
				propName = &quot;effectOut&quot;;
				dir = -1;
			}

			var effects = getElementsByPropertyNS(node, NSS[&quot;jessyink&quot;], propName);

			for (var effectCounter = 0; effectCounter &lt; effects.length; effectCounter++)
			{
				var element = document.getElementById(effects[effectCounter]);
				var dict = propStrToDict(element.getAttributeNS(NSS[&quot;jessyink&quot;], propName));

				// Put every element that has an effect associated with it, into its own group.
				// Unless of course, we already put it into its own group.
				if (!(groups[element.id]))
				{
					var newGroup = document.createElementNS(NSS[&quot;svg&quot;], &quot;g&quot;);

					element.parentNode.insertBefore(newGroup, element);
					newGroup.appendChild(element.parentNode.removeChild(element));
					groups[element.id] = newGroup;
				}

				var effectDict = new Object();

				effectDict[&quot;effect&quot;] = dict[&quot;name&quot;];
				effectDict[&quot;dir&quot;] = dir;
				effectDict[&quot;element&quot;] = groups[element.id];

				for (var option in dict)
				{
					if ((option != &quot;name&quot;) &amp;&amp; (option != &quot;order&quot;))
					{
						if (!effectDict[&quot;options&quot;])
							effectDict[&quot;options&quot;] = new Object();

						effectDict[&quot;options&quot;][option] = dict[option];
					}
				}

				if (!tempEffects[dict[&quot;order&quot;]])
					tempEffects[dict[&quot;order&quot;]] = new Array();

				tempEffects[dict[&quot;order&quot;]][tempEffects[dict[&quot;order&quot;]].length] = effectDict;
			}
		}

		// Make invisible, but keep in rendering tree to ensure that bounding box can be calculated.
		node.setAttribute(&quot;opacity&quot;,0);
		node.style.display = &quot;inherit&quot;;

		// Create a transform group.
		var transformGroup = document.createElementNS(NSS[&quot;svg&quot;], &quot;g&quot;);

		// Add content to transform group.
		while (node.firstChild)
			transformGroup.appendChild(node.firstChild);

		// Transfer the transform attribute from the node to the transform group.
		if (node.getAttribute(&quot;transform&quot;))
		{
			transformGroup.setAttribute(&quot;transform&quot;, node.getAttribute(&quot;transform&quot;));
			node.removeAttribute(&quot;transform&quot;);
		}

		// Create a view group.
		var viewGroup = document.createElementNS(NSS[&quot;svg&quot;], &quot;g&quot;);

		viewGroup.appendChild(transformGroup);
		slides[counter][&quot;viewGroup&quot;] = node.appendChild(viewGroup);

		// Insert background.
		if (BACKGROUND_COLOR != null)
		{
			var rectNode = document.createElementNS(NSS[&quot;svg&quot;], &quot;rect&quot;);

			rectNode.setAttribute(&quot;x&quot;, 0);
			rectNode.setAttribute(&quot;y&quot;, 0);
			rectNode.setAttribute(&quot;width&quot;, WIDTH);
			rectNode.setAttribute(&quot;height&quot;, HEIGHT);
			rectNode.setAttribute(&quot;id&quot;, &quot;jessyInkBackground&quot; + counter);
			rectNode.setAttribute(&quot;fill&quot;, BACKGROUND_COLOR);

			slides[counter][&quot;viewGroup&quot;].insertBefore(rectNode, slides[counter][&quot;viewGroup&quot;].firstChild);
		}

		// Set views.
		var tempViews = new Array();
		var views = getElementsByPropertyNS(node, NSS[&quot;jessyink&quot;], &quot;view&quot;);
		var matrixOld = (new matrixSVG()).fromElements(1, 0, 0, 0, 1, 0, 0, 0, 1);

		// Set initial view even if there are no other views.
		slides[counter][&quot;viewGroup&quot;].setAttribute(&quot;transform&quot;, matrixOld.toAttribute());
		slides[counter].initialView = matrixOld.toAttribute();

		for (var viewCounter = 0; viewCounter &lt; views.length; viewCounter++)
		{
			var element = document.getElementById(views[viewCounter]);
			var dict = propStrToDict(element.getAttributeNS(NSS[&quot;jessyink&quot;], &quot;view&quot;));

			if (dict[&quot;order&quot;] == 0)
			{
				matrixOld = pointMatrixToTransformation(rectToMatrix(element)).mult((new matrixSVG()).fromSVGMatrix(slides[counter].viewGroup.getScreenCTM()).inv().mult((new matrixSVG()).fromSVGMatrix(element.parentNode.getScreenCTM())).inv());
				slides[counter].initialView = matrixOld.toAttribute();
			}
			else
			{
				var effectDict = new Object();

				effectDict[&quot;effect&quot;] = dict[&quot;name&quot;];
				effectDict[&quot;dir&quot;] = 1;
				effectDict[&quot;element&quot;] = slides[counter][&quot;viewGroup&quot;];
				effectDict[&quot;order&quot;] = dict[&quot;order&quot;];

				for (var option in dict)
				{
					if ((option != &quot;name&quot;) &amp;&amp; (option != &quot;order&quot;))
					{
						if (!effectDict[&quot;options&quot;])
							effectDict[&quot;options&quot;] = new Object();

						effectDict[&quot;options&quot;][option] = dict[option];
					}
				}

				effectDict[&quot;options&quot;][&quot;matrixNew&quot;] = pointMatrixToTransformation(rectToMatrix(element)).mult((new matrixSVG()).fromSVGMatrix(slides[counter].viewGroup.getScreenCTM()).inv().mult((new matrixSVG()).fromSVGMatrix(element.parentNode.getScreenCTM())).inv());

				tempViews[dict[&quot;order&quot;]] = effectDict;
			}

			// Remove element.
			element.parentNode.removeChild(element);
		}

		// Consolidate view array and append it to the effect array.
		if (tempViews.length &gt; 0)
		{
			for (var viewCounter = 0; viewCounter &lt; tempViews.length; viewCounter++)
			{
				if (tempViews[viewCounter])
				{
					tempViews[viewCounter][&quot;options&quot;][&quot;matrixOld&quot;] = matrixOld;
					matrixOld = tempViews[viewCounter][&quot;options&quot;][&quot;matrixNew&quot;];

					if (!tempEffects[tempViews[viewCounter][&quot;order&quot;]])
						tempEffects[tempViews[viewCounter][&quot;order&quot;]] = new Array();

					tempEffects[tempViews[viewCounter][&quot;order&quot;]][tempEffects[tempViews[viewCounter][&quot;order&quot;]].length] = tempViews[viewCounter];
				}
			}
		}

		// Set consolidated effect array.
		if (tempEffects.length &gt; 0)
		{
			slides[counter][&quot;effects&quot;] = new Array();

			for (var effectCounter = 0; effectCounter &lt; tempEffects.length; effectCounter++)
			{
				if (tempEffects[effectCounter])
					slides[counter][&quot;effects&quot;][slides[counter][&quot;effects&quot;].length] = tempEffects[effectCounter];
			}
		}

		node.setAttribute(&quot;onmouseover&quot;, &quot;if ((currentMode == INDEX_MODE) &amp;&amp; ( activeSlide != &quot; + counter + &quot;)) { indexSetActiveSlide(&quot; + counter + &quot;); };&quot;);

		// Set visibility for initial state.
		if (counter == activeSlide)
		{
			node.style.display = &quot;inherit&quot;;
			node.setAttribute(&quot;opacity&quot;,1);
		}
		else
		{
			node.style.display = &quot;none&quot;;
			node.setAttribute(&quot;opacity&quot;,0);
		}
	}

	// Set key handler.
	var jessyInkObjects = document.getElementsByTagNameNS(NSS[&quot;svg&quot;], &quot;g&quot;);

	for (var counter = 0; counter &lt; jessyInkObjects.length; counter++)
	{
		var elem = jessyInkObjects[counter];

		if (elem.getAttributeNS(NSS[&quot;jessyink&quot;], &quot;customKeyBindings&quot;))
		{
			if (elem.getCustomKeyBindings != undefined)
				keyCodeDictionary = elem.getCustomKeyBindings();

			if (elem.getCustomCharBindings != undefined)
				charCodeDictionary = elem.getCustomCharBindings();
		}
	}

	// Set mouse handler.
	var jessyInkMouseHandler = document.getElementsByTagNameNS(NSS[&quot;jessyink&quot;], &quot;mousehandler&quot;);

	for (var counter = 0; counter &lt; jessyInkMouseHandler.length; counter++)
	{
		var elem = jessyInkMouseHandler[counter];

		if (elem.getMouseHandler != undefined)
		{
			var tempDict = elem.getMouseHandler();

			for (mode in tempDict)
			{
				if (!mouseHandlerDictionary[mode])
					mouseHandlerDictionary[mode] = new Object();

				for (handler in tempDict[mode])
					mouseHandlerDictionary[mode][handler] = tempDict[mode][handler];
			}
		}
	}

	// Check effect number.
	if ((activeEffect &lt; 0) || (!slides[activeSlide].effects))
	{
		activeEffect = 0;
	}
	else if (activeEffect &gt; slides[activeSlide].effects.length)
	{
		activeEffect = slides[activeSlide].effects.length;
	}

	createProgressBar(JessyInkPresentationLayer);
	hideProgressBar();
	setProgressBarValue(activeSlide);
	setTimeIndicatorValue(0);
	setInterval(&quot;updateTimer()&quot;, 1000);
	setSlideToState(activeSlide, activeEffect);
	jessyInkInitialised = true;
}

/** Function to subtitute the auto-texts.
 *
 *  @param node the node
 *  @param slideName name of the slide the node is on
 *  @param slideNumber number of the slide the node is on
 *  @param numberOfSlides number of slides in the presentation
 */
function substituteAutoTexts(node, slideName, slideNumber, numberOfSlides)
{
	var texts = node.getElementsByTagNameNS(NSS[&quot;svg&quot;], &quot;tspan&quot;);

	for (var textCounter = 0; textCounter &lt; texts.length; textCounter++)
	{
		if (texts[textCounter].getAttributeNS(NSS[&quot;jessyink&quot;], &quot;autoText&quot;) == &quot;slideNumber&quot;)
			texts[textCounter].firstChild.nodeValue = slideNumber;
		else if (texts[textCounter].getAttributeNS(NSS[&quot;jessyink&quot;], &quot;autoText&quot;) == &quot;numberOfSlides&quot;)
			texts[textCounter].firstChild.nodeValue = numberOfSlides;
		else if (texts[textCounter].getAttributeNS(NSS[&quot;jessyink&quot;], &quot;autoText&quot;) == &quot;slideTitle&quot;)
			texts[textCounter].firstChild.nodeValue = slideName;
	}
}

/** Convenience function to get an element depending on whether it has a property with a particular name.
 *	This function emulates some dearly missed XPath functionality.
 *
 *  @param node the node
 *  @param namespace namespace of the attribute
 *  @param name attribute name
 */
function getElementsByPropertyNS(node, namespace, name)
{
	var elems = new Array();

	if (node.getAttributeNS(namespace, name))
		elems.push(node.getAttribute(&quot;id&quot;));

	for (var counter = 0; counter &lt; node.childNodes.length; counter++)
	{
		if (node.childNodes[counter].nodeType == 1)
			elems = elems.concat(getElementsByPropertyNS(node.childNodes[counter], namespace, name));
	}

	return elems;
}

/** Function to dispatch the next effect, if there is none left, change the slide.
 *
 *  @param dir direction of the change (1 = forwards, -1 = backwards)
 */
function dispatchEffects(dir)
{
	if (slides[activeSlide][&quot;effects&quot;] &amp;&amp; (((dir == 1) &amp;&amp; (activeEffect &lt; slides[activeSlide][&quot;effects&quot;].length)) || ((dir == -1) &amp;&amp; (activeEffect &gt; 0))))
	{
		processingEffect = true;

		if (dir == 1)
		{
			effectArray = slides[activeSlide][&quot;effects&quot;][activeEffect];
			activeEffect += dir;
		}
		else if (dir == -1)
		{
			activeEffect += dir;
			effectArray = slides[activeSlide][&quot;effects&quot;][activeEffect];
		}

		transCounter = 0;
		startTime = (new Date()).getTime();
		lastFrameTime = null;
		effect(dir);
	}
	else if (((dir == 1) &amp;&amp; (activeSlide &lt; (slides.length - 1))) || (((dir == -1) &amp;&amp; (activeSlide &gt; 0))))
	{
		changeSlide(dir);
	}
}

/** Function to skip effects and directly either put the slide into start or end state or change slides.
 *
 *  @param dir direction of the change (1 = forwards, -1 = backwards)
 */
function skipEffects(dir)
{
	if (slides[activeSlide][&quot;effects&quot;] &amp;&amp; (((dir == 1) &amp;&amp; (activeEffect &lt; slides[activeSlide][&quot;effects&quot;].length)) || ((dir == -1) &amp;&amp; (activeEffect &gt; 0))))
	{
		processingEffect = true;

		if (slides[activeSlide][&quot;effects&quot;] &amp;&amp; (dir == 1))
			activeEffect = slides[activeSlide][&quot;effects&quot;].length;
		else
			activeEffect = 0;

		if (dir == 1)
			setSlideToState(activeSlide, STATE_END);
		else
			setSlideToState(activeSlide, STATE_START);

		processingEffect = false;
	}
	else if (((dir == 1) &amp;&amp; (activeSlide &lt; (slides.length - 1))) || (((dir == -1) &amp;&amp; (activeSlide &gt; 0))))
	{
		changeSlide(dir);
	}
}

/** Function to change between slides.
 *
 *  @param dir direction (1 = forwards, -1 = backwards)
 */
function changeSlide(dir)
{
	processingEffect = true;
	effectArray = new Array();

	effectArray[0] = new Object();
	if (dir == 1)
	{
		effectArray[0][&quot;effect&quot;] = slides[activeSlide][&quot;transitionOut&quot;][&quot;name&quot;];
		effectArray[0][&quot;options&quot;] = slides[activeSlide][&quot;transitionOut&quot;][&quot;options&quot;];
		effectArray[0][&quot;dir&quot;] = -1;
	}
	else if (dir == -1)
	{
		effectArray[0][&quot;effect&quot;] = slides[activeSlide][&quot;transitionIn&quot;][&quot;name&quot;];
		effectArray[0][&quot;options&quot;] = slides[activeSlide][&quot;transitionIn&quot;][&quot;options&quot;];
		effectArray[0][&quot;dir&quot;] = 1;
	}
	effectArray[0][&quot;element&quot;] = slides[activeSlide][&quot;element&quot;];

	activeSlide += dir;
	setProgressBarValue(activeSlide);

	effectArray[1] = new Object();

	if (dir == 1)
	{
		effectArray[1][&quot;effect&quot;] = slides[activeSlide][&quot;transitionIn&quot;][&quot;name&quot;];
		effectArray[1][&quot;options&quot;] = slides[activeSlide][&quot;transitionIn&quot;][&quot;options&quot;];
		effectArray[1][&quot;dir&quot;] = 1;
	}
	else if (dir == -1)
	{
		effectArray[1][&quot;effect&quot;] = slides[activeSlide][&quot;transitionOut&quot;][&quot;name&quot;];
		effectArray[1][&quot;options&quot;] = slides[activeSlide][&quot;transitionOut&quot;][&quot;options&quot;];
		effectArray[1][&quot;dir&quot;] = -1;
	}

	effectArray[1][&quot;element&quot;] = slides[activeSlide][&quot;element&quot;];

	if (slides[activeSlide][&quot;effects&quot;] &amp;&amp; (dir == -1))
		activeEffect = slides[activeSlide][&quot;effects&quot;].length;
	else
		activeEffect = 0;

	if (dir == -1)
		setSlideToState(activeSlide, STATE_END);
	else
		setSlideToState(activeSlide, STATE_START);

	transCounter = 0;
	startTime = (new Date()).getTime();
	lastFrameTime = null;
	effect(dir);
}

/** Function to toggle between index and slide mode.
*/
function toggleSlideIndex()
{
	var suspendHandle = ROOT_NODE.suspendRedraw(500);

	if (currentMode == SLIDE_MODE)
	{
		hideProgressBar();		
		INDEX_OFFSET = -1;
		indexSetPageSlide(activeSlide);
		currentMode = INDEX_MODE;
	}
	else if (currentMode == INDEX_MODE)
	{
		for (var counter = 0; counter &lt; slides.length; counter++)
		{
			slides[counter][&quot;element&quot;].setAttribute(&quot;transform&quot;,&quot;scale(1)&quot;);

			if (counter == activeSlide)
			{
				slides[counter][&quot;element&quot;].style.display = &quot;inherit&quot;;
				slides[counter][&quot;element&quot;].setAttribute(&quot;opacity&quot;,1);
				activeEffect = 0;
			}
			else
			{
				slides[counter][&quot;element&quot;].setAttribute(&quot;opacity&quot;,0);
				slides[counter][&quot;element&quot;].style.display = &quot;none&quot;;
			}
		}
		currentMode = SLIDE_MODE;
		setSlideToState(activeSlide, STATE_START);
		setProgressBarValue(activeSlide);

		if (progress_bar_visible)
		{
			showProgressBar();
		}
	}

	ROOT_NODE.unsuspendRedraw(suspendHandle);
	ROOT_NODE.forceRedraw();
}

/** Function to run an effect.
 *
 *  @param dir direction in which to play the effect (1 = forwards, -1 = backwards)
 */
function effect(dir)
{
	var done = true;

	var suspendHandle = ROOT_NODE.suspendRedraw(200);

	for (var counter = 0; counter &lt; effectArray.length; counter++)
	{
		if (effectArray[counter][&quot;effect&quot;] == &quot;fade&quot;)
			done &amp;= fade(parseInt(effectArray[counter][&quot;dir&quot;]) * dir, effectArray[counter][&quot;element&quot;], transCounter, effectArray[counter][&quot;options&quot;]);
		else if (effectArray[counter][&quot;effect&quot;] == &quot;appear&quot;)
			done &amp;= appear(parseInt(effectArray[counter][&quot;dir&quot;]) * dir, effectArray[counter][&quot;element&quot;], transCounter, effectArray[counter][&quot;options&quot;]);
		else if (effectArray[counter][&quot;effect&quot;] == &quot;pop&quot;)
			done &amp;= pop(parseInt(effectArray[counter][&quot;dir&quot;]) * dir, effectArray[counter][&quot;element&quot;], transCounter, effectArray[counter][&quot;options&quot;]);
		else if (effectArray[counter][&quot;effect&quot;] == &quot;view&quot;)
			done &amp;= view(parseInt(effectArray[counter][&quot;dir&quot;]) * dir, effectArray[counter][&quot;element&quot;], transCounter, effectArray[counter][&quot;options&quot;]);
	}

	ROOT_NODE.unsuspendRedraw(suspendHandle);
	ROOT_NODE.forceRedraw();

	if (!done)
	{
		var currentTime = (new Date()).getTime();
		var timeDiff = 1;

		transCounter = currentTime - startTime;

		if (lastFrameTime != null)
		{
			timeDiff = timeStep - (currentTime - lastFrameTime);

			if (timeDiff &lt;= 0)
				timeDiff = 1;
		}

		lastFrameTime = currentTime;

		window.setTimeout(&quot;effect(&quot; + dir + &quot;)&quot;, timeDiff);
	}
	else
	{
		window.location.hash = (activeSlide + 1) + '_' + activeEffect;
		processingEffect = false;
	}
}

/** Function to display the index sheet.
 *
 *  @param offsetNumber offset number
 */
function displayIndex(offsetNumber)
{
	var offsetX = 0;
	var offsetY = 0;

	if (offsetNumber &lt; 0)
		offsetNumber = 0;
	else if (offsetNumber &gt;= slides.length)
		offsetNumber = slides.length - 1;

	for (var counter = 0; counter &lt; slides.length; counter++)
	{
		if ((counter &lt; offsetNumber) || (counter &gt; offsetNumber + INDEX_COLUMNS * INDEX_COLUMNS - 1))
		{
			slides[counter][&quot;element&quot;].setAttribute(&quot;opacity&quot;,0);
			slides[counter][&quot;element&quot;].style.display = &quot;none&quot;;
		}
		else
		{
			offsetX = ((counter - offsetNumber) % INDEX_COLUMNS) * WIDTH;
			offsetY = Math.floor((counter - offsetNumber) / INDEX_COLUMNS) * HEIGHT;

			slides[counter][&quot;element&quot;].setAttribute(&quot;transform&quot;,&quot;scale(&quot;+1/INDEX_COLUMNS+&quot;) translate(&quot;+offsetX+&quot;,&quot;+offsetY+&quot;)&quot;);
			slides[counter][&quot;element&quot;].style.display = &quot;inherit&quot;;
			slides[counter][&quot;element&quot;].setAttribute(&quot;opacity&quot;,0.5);
		}

		setSlideToState(counter, STATE_END);
	}

	//do we need to save the current offset?
	if (INDEX_OFFSET != offsetNumber)
		INDEX_OFFSET = offsetNumber;
}

/** Function to set the active slide in the slide view.
 *
 *  @param nbr index of the active slide
 */
function slideSetActiveSlide(nbr)
{
	if (nbr &gt;= slides.length)
		nbr = slides.length - 1;
	else if (nbr &lt; 0)
		nbr = 0;

	slides[activeSlide][&quot;element&quot;].setAttribute(&quot;opacity&quot;,0);
	slides[activeSlide][&quot;element&quot;].style.display = &quot;none&quot;;

	activeSlide = parseInt(nbr);

	setSlideToState(activeSlide, STATE_START);
	slides[activeSlide][&quot;element&quot;].style.display = &quot;inherit&quot;;
	slides[activeSlide][&quot;element&quot;].setAttribute(&quot;opacity&quot;,1);

	activeEffect = 0;
	setProgressBarValue(nbr);
}

/** Function to set the active slide in the index view.
 *
 *  @param nbr index of the active slide
 */
function indexSetActiveSlide(nbr)
{
	if (nbr &gt;= slides.length)
		nbr = slides.length - 1;
	else if (nbr &lt; 0)
		nbr = 0;

	slides[activeSlide][&quot;element&quot;].setAttribute(&quot;opacity&quot;,0.5);

	activeSlide = parseInt(nbr);
	window.location.hash = (activeSlide + 1) + '_0';

	slides[activeSlide][&quot;element&quot;].setAttribute(&quot;opacity&quot;,1);
}

/** Function to set the page and active slide in index view. 
 *
 *  @param nbr index of the active slide
 *
 *  NOTE: To force a redraw,
 *  set INDEX_OFFSET to -1 before calling indexSetPageSlide().
 *
 *  This is necessary for zooming (otherwise the index might not
 *  get redrawn) and when switching to index mode.
 *
 *  INDEX_OFFSET = -1
 *  indexSetPageSlide(activeSlide);
 */
function indexSetPageSlide(nbr)
{
	if (nbr &gt;= slides.length)
		nbr = slides.length - 1;
	else if (nbr &lt; 0)
		nbr = 0;

	//calculate the offset
	var offset = nbr - nbr % (INDEX_COLUMNS * INDEX_COLUMNS);

	if (offset &lt; 0)
		offset = 0;

	//if different from kept offset, then record and change the page
	if (offset != INDEX_OFFSET)
	{
		INDEX_OFFSET = offset;
		displayIndex(INDEX_OFFSET);
	}

	//set the active slide
	indexSetActiveSlide(nbr);
}

/** Event handler for key press.
 *
 *  @param e the event
 */
function keydown(e)
{
	if (!e)
		e = window.event;

	code = e.keyCode || e.charCode;

	if (!processingEffect &amp;&amp; keyCodeDictionary[currentMode] &amp;&amp; keyCodeDictionary[currentMode][code])
		return keyCodeDictionary[currentMode][code]();
	else
		document.onkeypress = keypress;
}
// Set event handler for key down.
document.onkeydown = keydown;

/** Event handler for key press.
 *
 *  @param e the event
 */
function keypress(e)
{
	document.onkeypress = null;

	if (!e)
		e = window.event;

	str = String.fromCharCode(e.keyCode || e.charCode);

	if (!processingEffect &amp;&amp; charCodeDictionary[currentMode] &amp;&amp; charCodeDictionary[currentMode][str])
		return charCodeDictionary[currentMode][str]();
}

/** Function to supply the default char code dictionary.
 *
 * @returns default char code dictionary
 */
function getDefaultCharCodeDictionary()
{
	var charCodeDict = new Object();

	charCodeDict[SLIDE_MODE] = new Object();
	charCodeDict[INDEX_MODE] = new Object();
	charCodeDict[DRAWING_MODE] = new Object();

	charCodeDict[SLIDE_MODE][&quot;i&quot;] = function () { return toggleSlideIndex(); };
	charCodeDict[SLIDE_MODE][&quot;d&quot;] = function () { return slideSwitchToDrawingMode(); };
	charCodeDict[SLIDE_MODE][&quot;D&quot;] = function () { return slideQueryDuration(); };
	charCodeDict[SLIDE_MODE][&quot;n&quot;] = function () { return slideAddSlide(activeSlide); };
	charCodeDict[SLIDE_MODE][&quot;p&quot;] = function () { return slideToggleProgressBarVisibility(); };
	charCodeDict[SLIDE_MODE][&quot;t&quot;] = function () { return slideResetTimer(); };
	charCodeDict[SLIDE_MODE][&quot;e&quot;] = function () { return slideUpdateExportLayer(); };

	charCodeDict[DRAWING_MODE][&quot;d&quot;] = function () { return drawingSwitchToSlideMode(); };
	charCodeDict[DRAWING_MODE][&quot;0&quot;] = function () { return drawingResetPathWidth(); };
	charCodeDict[DRAWING_MODE][&quot;1&quot;] = function () { return drawingSetPathWidth(1.0); };
	charCodeDict[DRAWING_MODE][&quot;3&quot;] = function () { return drawingSetPathWidth(3.0); };
	charCodeDict[DRAWING_MODE][&quot;5&quot;] = function () { return drawingSetPathWidth(5.0); };
	charCodeDict[DRAWING_MODE][&quot;7&quot;] = function () { return drawingSetPathWidth(7.0); };
	charCodeDict[DRAWING_MODE][&quot;9&quot;] = function () { return drawingSetPathWidth(9.0); };
	charCodeDict[DRAWING_MODE][&quot;b&quot;] = function () { return drawingSetPathColour(&quot;blue&quot;); };
	charCodeDict[DRAWING_MODE][&quot;c&quot;] = function () { return drawingSetPathColour(&quot;cyan&quot;); };
	charCodeDict[DRAWING_MODE][&quot;g&quot;] = function () { return drawingSetPathColour(&quot;green&quot;); };
	charCodeDict[DRAWING_MODE][&quot;k&quot;] = function () { return drawingSetPathColour(&quot;black&quot;); };
	charCodeDict[DRAWING_MODE][&quot;m&quot;] = function () { return drawingSetPathColour(&quot;magenta&quot;); };
	charCodeDict[DRAWING_MODE][&quot;o&quot;] = function () { return drawingSetPathColour(&quot;orange&quot;); };
	charCodeDict[DRAWING_MODE][&quot;r&quot;] = function () { return drawingSetPathColour(&quot;red&quot;); };
	charCodeDict[DRAWING_MODE][&quot;w&quot;] = function () { return drawingSetPathColour(&quot;white&quot;); };
	charCodeDict[DRAWING_MODE][&quot;y&quot;] = function () { return drawingSetPathColour(&quot;yellow&quot;); };
	charCodeDict[DRAWING_MODE][&quot;z&quot;] = function () { return drawingUndo(); };

	charCodeDict[INDEX_MODE][&quot;i&quot;] = function () { return toggleSlideIndex(); };
	charCodeDict[INDEX_MODE][&quot;-&quot;] = function () { return indexDecreaseNumberOfColumns(); };
	charCodeDict[INDEX_MODE][&quot;=&quot;] = function () { return indexIncreaseNumberOfColumns(); };
	charCodeDict[INDEX_MODE][&quot;+&quot;] = function () { return indexIncreaseNumberOfColumns(); };
	charCodeDict[INDEX_MODE][&quot;0&quot;] = function () { return indexResetNumberOfColumns(); };

	return charCodeDict;
}

/** Function to supply the default key code dictionary.
 *
 * @returns default key code dictionary
 */
function getDefaultKeyCodeDictionary()
{
	var keyCodeDict = new Object();

	keyCodeDict[SLIDE_MODE] = new Object();
	keyCodeDict[INDEX_MODE] = new Object();
	keyCodeDict[DRAWING_MODE] = new Object();

	keyCodeDict[SLIDE_MODE][LEFT_KEY] = function() { return dispatchEffects(-1); };
	keyCodeDict[SLIDE_MODE][RIGHT_KEY] = function() { return dispatchEffects(1); };
	keyCodeDict[SLIDE_MODE][UP_KEY] = function() { return skipEffects(-1); };
	keyCodeDict[SLIDE_MODE][DOWN_KEY] = function() { return skipEffects(1); };
	keyCodeDict[SLIDE_MODE][PAGE_UP_KEY] = function() { return dispatchEffects(-1); };
	keyCodeDict[SLIDE_MODE][PAGE_DOWN_KEY] = function() { return dispatchEffects(1); };
	keyCodeDict[SLIDE_MODE][HOME_KEY] = function() { return slideSetActiveSlide(0); };
	keyCodeDict[SLIDE_MODE][END_KEY] = function() { return slideSetActiveSlide(slides.length - 1); };
	keyCodeDict[SLIDE_MODE][SPACE_KEY] = function() { return dispatchEffects(1); };

	keyCodeDict[INDEX_MODE][LEFT_KEY] = function() { return indexSetPageSlide(activeSlide - 1); };
	keyCodeDict[INDEX_MODE][RIGHT_KEY] = function() { return indexSetPageSlide(activeSlide + 1); };
	keyCodeDict[INDEX_MODE][UP_KEY] = function() { return indexSetPageSlide(activeSlide - INDEX_COLUMNS); };
	keyCodeDict[INDEX_MODE][DOWN_KEY] = function() { return indexSetPageSlide(activeSlide + INDEX_COLUMNS); };
	keyCodeDict[INDEX_MODE][PAGE_UP_KEY] = function() { return indexSetPageSlide(activeSlide - INDEX_COLUMNS * INDEX_COLUMNS); };
	keyCodeDict[INDEX_MODE][PAGE_DOWN_KEY] = function() { return indexSetPageSlide(activeSlide + INDEX_COLUMNS * INDEX_COLUMNS); };
	keyCodeDict[INDEX_MODE][HOME_KEY] = function() { return indexSetPageSlide(0); };
	keyCodeDict[INDEX_MODE][END_KEY] = function() { return indexSetPageSlide(slides.length - 1); };
	keyCodeDict[INDEX_MODE][ENTER_KEY] = function() { return toggleSlideIndex(); };

	keyCodeDict[DRAWING_MODE][ESCAPE_KEY] = function () { return drawingSwitchToSlideMode(); };

	return keyCodeDict;
}

/** Function to handle all mouse events.
 *
 *	@param	evnt	event
 *	@param	action	type of event (e.g. mouse up, mouse wheel)
 */
function mouseHandlerDispatch(evnt, action)
{
	if (!evnt)
		evnt = window.event;

	var retVal = true;

	if (!processingEffect &amp;&amp; mouseHandlerDictionary[currentMode] &amp;&amp; mouseHandlerDictionary[currentMode][action])
	{
		var subRetVal = mouseHandlerDictionary[currentMode][action](evnt);

		if (subRetVal != null &amp;&amp; subRetVal != undefined)
			retVal = subRetVal;
	}

	if (evnt.preventDefault &amp;&amp; !retVal)
		evnt.preventDefault();

	evnt.returnValue = retVal;

	return retVal;
}

// Set mouse event handler.
document.onmousedown = function(e) { return mouseHandlerDispatch(e, MOUSE_DOWN); };
document.onmouseup = function(e) { return mouseHandlerDispatch(e, MOUSE_UP); };
document.onmousemove = function(e) { return mouseHandlerDispatch(e, MOUSE_MOVE); };

// Moz
if (window.addEventListener)
{
	window.addEventListener('DOMMouseScroll', function(e) { return mouseHandlerDispatch(e, MOUSE_WHEEL); }, false);
}

// Opera Safari OK - may not work in IE
window.onmousewheel = function(e) { return mouseHandlerDispatch(e, MOUSE_WHEEL); };

/** Function to supply the default mouse handler dictionary.
 *
 * @returns default mouse handler dictionary
 */
function getDefaultMouseHandlerDictionary()
{
	var mouseHandlerDict = new Object();

	mouseHandlerDict[SLIDE_MODE] = new Object();
	mouseHandlerDict[INDEX_MODE] = new Object();
	mouseHandlerDict[DRAWING_MODE] = new Object();

	mouseHandlerDict[SLIDE_MODE][MOUSE_DOWN] = function(evnt) { return dispatchEffects(1); };
	mouseHandlerDict[SLIDE_MODE][MOUSE_WHEEL] = function(evnt) { return slideMousewheel(evnt); };

	mouseHandlerDict[INDEX_MODE][MOUSE_DOWN] = function(evnt) { return toggleSlideIndex(); };

	mouseHandlerDict[DRAWING_MODE][MOUSE_DOWN] = function(evnt) { return drawingMousedown(evnt); };
	mouseHandlerDict[DRAWING_MODE][MOUSE_UP] = function(evnt) { return drawingMouseup(evnt); };
	mouseHandlerDict[DRAWING_MODE][MOUSE_MOVE] = function(evnt) { return drawingMousemove(evnt); };

	return mouseHandlerDict;
}

/** Function to switch from slide mode to drawing mode.
*/
function slideSwitchToDrawingMode()
{
	currentMode = DRAWING_MODE;

	var tempDict;

	if (ROOT_NODE.hasAttribute(&quot;style&quot;))
		tempDict = propStrToDict(ROOT_NODE.getAttribute(&quot;style&quot;));
	else
		tempDict = new Object();

	tempDict[&quot;cursor&quot;] = &quot;crosshair&quot;;
	ROOT_NODE.setAttribute(&quot;style&quot;, dictToPropStr(tempDict));
}

/** Function to switch from drawing mode to slide mode.
*/
function drawingSwitchToSlideMode()
{
	currentMode = SLIDE_MODE;

	var tempDict;

	if (ROOT_NODE.hasAttribute(&quot;style&quot;))
		tempDict = propStrToDict(ROOT_NODE.getAttribute(&quot;style&quot;));
	else
		tempDict = new Object();

	tempDict[&quot;cursor&quot;] = &quot;auto&quot;;
	ROOT_NODE.setAttribute(&quot;style&quot;, dictToPropStr(tempDict));
}

/** Function to decrease the number of columns in index mode.
*/
function indexDecreaseNumberOfColumns()
{
	if (INDEX_COLUMNS &gt;= 3)
	{
		INDEX_COLUMNS -= 1;
		INDEX_OFFSET = -1
			indexSetPageSlide(activeSlide);
	}
}

/** Function to increase the number of columns in index mode.
*/
function indexIncreaseNumberOfColumns()
{
	if (INDEX_COLUMNS &lt; 7)
	{
		INDEX_COLUMNS += 1;
		INDEX_OFFSET = -1
			indexSetPageSlide(activeSlide);
	}
}

/** Function to reset the number of columns in index mode.
*/
function indexResetNumberOfColumns()
{
	if (INDEX_COLUMNS != INDEX_COLUMNS_DEFAULT)
	{
		INDEX_COLUMNS = INDEX_COLUMNS_DEFAULT;
		INDEX_OFFSET = -1
			indexSetPageSlide(activeSlide);
	}
}

/** Function to reset path width in drawing mode.
*/
function drawingResetPathWidth()
{
	path_width = path_width_default;
	set_path_paint_width();
}

/** Function to set path width in drawing mode.
 *
 * @param width new path width
 */
function drawingSetPathWidth(width)
{
	path_width = width;
	set_path_paint_width();
}

/** Function to set path colour in drawing mode.
 *
 * @param colour new path colour
 */
function drawingSetPathColour(colour)
{
	path_colour = colour;
}

/** Function to query the duration of the presentation from the user in slide mode.
*/
function slideQueryDuration()
{
	var new_duration = prompt(&quot;Length of presentation in minutes?&quot;, timer_duration);

	if ((new_duration != null) &amp;&amp; (new_duration != ''))
	{
		timer_duration = new_duration;
	}

	updateTimer();
}

/** Function to add new slide in slide mode.
 *
 * @param afterSlide after which slide to insert the new one
 */
function slideAddSlide(afterSlide)
{
	addSlide(afterSlide);
	slideSetActiveSlide(afterSlide + 1);
	updateTimer();
}

/** Function to toggle the visibility of the progress bar in slide mode.
*/
function slideToggleProgressBarVisibility()
{
	if (progress_bar_visible)
	{
		progress_bar_visible = false;
		hideProgressBar();
	}
	else
	{
		progress_bar_visible = true;
		showProgressBar();
	}
}

/** Function to reset the timer in slide mode.
*/
function slideResetTimer()
{
	timer_start = timer_elapsed;
	updateTimer();
}

/** Convenience function to pad a string with zero in front up to a certain length.
 */
function padString(str, len)
{
	var outStr = str;

	while (outStr.length &lt; len)
	{
		outStr = '0' + outStr;
	}

	return outStr;
}

/** Function to update the export layer.
 */
function slideUpdateExportLayer()
{
	// Suspend redraw since we are going to mess with the slides.
	var suspendHandle = ROOT_NODE.suspendRedraw(2000);

	var tmpActiveSlide = activeSlide;
	var tmpActiveEffect = activeEffect;
	var exportedLayers = new Array();

	for (var counterSlides = 0; counterSlides &lt; slides.length; counterSlides++)
	{
		var exportNode;

		setSlideToState(counterSlides, STATE_START);

		var maxEffect = 0;

		if (slides[counterSlides].effects)
		{
			maxEffect = slides[counterSlides].effects.length;
		}

		exportNode = slides[counterSlides].element.cloneNode(true);
		exportNode.setAttributeNS(NSS[&quot;inkscape&quot;], &quot;groupmode&quot;, &quot;layer&quot;);
		exportNode.setAttributeNS(NSS[&quot;inkscape&quot;], &quot;label&quot;, &quot;slide_&quot; + padString((counterSlides + 1).toString(), slides.length.toString().length) + &quot;_effect_&quot; + padString(&quot;0&quot;, maxEffect.toString().length));

		exportedLayers.push(exportNode);

		if (slides[counterSlides][&quot;effects&quot;])
		{	
			for (var counter = 0; counter &lt; slides[counterSlides][&quot;effects&quot;].length; counter++)
			{
				for (var subCounter = 0; subCounter &lt; slides[counterSlides][&quot;effects&quot;][counter].length; subCounter++)
				{
					var effect = slides[counterSlides][&quot;effects&quot;][counter][subCounter];
					if (effect[&quot;effect&quot;] == &quot;fade&quot;)
						fade(parseInt(effect[&quot;dir&quot;]), effect[&quot;element&quot;], STATE_END, effect[&quot;options&quot;]);	
					else if (effect[&quot;effect&quot;] == &quot;appear&quot;)
						appear(parseInt(effect[&quot;dir&quot;]), effect[&quot;element&quot;], STATE_END, effect[&quot;options&quot;]);	
					else if (effect[&quot;effect&quot;] == &quot;pop&quot;)
						pop(parseInt(effect[&quot;dir&quot;]), effect[&quot;element&quot;], STATE_END, effect[&quot;options&quot;]);	
					else if (effect[&quot;effect&quot;] == &quot;view&quot;)
						view(parseInt(effect[&quot;dir&quot;]), effect[&quot;element&quot;], STATE_END, effect[&quot;options&quot;]);	
				}

				var layerName = &quot;slide_&quot; + padString((counterSlides + 1).toString(), slides.length.toString().length) + &quot;_effect_&quot; + padString((counter + 1).toString(), maxEffect.toString().length);
				exportNode = slides[counterSlides].element.cloneNode(true);
				exportNode.setAttributeNS(NSS[&quot;inkscape&quot;], &quot;groupmode&quot;, &quot;layer&quot;);
				exportNode.setAttributeNS(NSS[&quot;inkscape&quot;], &quot;label&quot;, layerName);
				exportNode.setAttribute(&quot;id&quot;, layerName);

				exportedLayers.push(exportNode);
			}
		}
	}

	activeSlide = tmpActiveSlide;
	activeEffect = tmpActiveEffect;
	setSlideToState(activeSlide, activeEffect);

	// Copy image.
	var newDoc = document.documentElement.cloneNode(true);

	// Delete viewbox form new imag and set width and height.
	newDoc.removeAttribute('viewbox');
	newDoc.setAttribute('width', WIDTH);
	newDoc.setAttribute('height', HEIGHT);

	// Delete all layers and script elements.
	var nodesToBeRemoved = new Array();

	for (var childCounter = 0; childCounter &lt;  newDoc.childNodes.length; childCounter++)
	{
		var child = newDoc.childNodes[childCounter];

		if (child.nodeType == 1)
		{
			if ((child.nodeName.toUpperCase() == 'G') || (child.nodeName.toUpperCase() == 'SCRIPT'))
			{
				nodesToBeRemoved.push(child);
			}
		}
	}

	for (var ndCounter = 0; ndCounter &lt; nodesToBeRemoved.length; ndCounter++)
	{
		var nd = nodesToBeRemoved[ndCounter];

		// Before removing the node, check whether it contains any definitions.
		var defs = nd.getElementsByTagNameNS(NSS[&quot;svg&quot;], &quot;defs&quot;);

		for (var defsCounter = 0; defsCounter &lt; defs.length; defsCounter++)
		{
			if (defs[defsCounter].id)
			{
				newDoc.appendChild(defs[defsCounter].cloneNode(true));
			}
		}

		// Remove node.
		nd.parentNode.removeChild(nd);
	}

	// Set current layer.
	if (exportedLayers[0])
	{
		var namedView;

		for (var nodeCounter = 0; nodeCounter &lt; newDoc.childNodes.length; nodeCounter++)
		{
			if ((newDoc.childNodes[nodeCounter].nodeType == 1) &amp;&amp; (newDoc.childNodes[nodeCounter].getAttribute('id') == 'base'))
			{
				namedView = newDoc.childNodes[nodeCounter];
			}
		}

		if (namedView)
		{
			namedView.setAttributeNS(NSS['inkscape'], 'current-layer', exportedLayers[0].getAttributeNS(NSS['inkscape'], 'label'));
		}
	}

	// Add exported layers.
	while (exportedLayers.length &gt; 0)
	{
		var nd = exportedLayers.pop();

		nd.setAttribute(&quot;opacity&quot;,1);
		nd.style.display = &quot;inherit&quot;;

		newDoc.appendChild(nd);
	}

	// Serialise the new document.
	var serializer = new XMLSerializer();
	var strm = 
	{
		content : &quot;&quot;,
		close : function() {},  
		flush : function() {},  
		write : function(str, count) { this.content += str; }  
	};

	var xml = serializer.serializeToStream(newDoc, strm, 'UTF-8');

	window.location = 'data:application/svg+xml;base64;charset=utf-8,' + window.btoa(strm.content);

	// Unsuspend redraw.
	ROOT_NODE.unsuspendRedraw(suspendHandle);
	ROOT_NODE.forceRedraw();
}

/** Function to undo last drawing operation.
*/
function drawingUndo()
{
	mouse_presentation_path = null;
	mouse_original_path = null;

	if (history_presentation_elements.length &gt; 0)
	{
		var p = history_presentation_elements.pop();
		var parent = p.parentNode.removeChild(p);

		p = history_original_elements.pop();
		parent = p.parentNode.removeChild(p);
	}
}

/** Event handler for mouse down in drawing mode.
 *
 *  @param e the event
 */
function drawingMousedown(e)
{
	var value = 0;

	if (e.button)
		value = e.button;
	else if (e.which)
		value = e.which;

	if (value == 1)
	{
		history_counter++;

		var p = calcCoord(e);

		mouse_last_x = e.clientX;
		mouse_last_y = e.clientY;
		mouse_original_path = document.createElementNS(NSS[&quot;svg&quot;], &quot;path&quot;);
		mouse_original_path.setAttribute(&quot;stroke&quot;, path_colour);
		mouse_original_path.setAttribute(&quot;stroke-width&quot;, path_paint_width);
		mouse_original_path.setAttribute(&quot;fill&quot;, &quot;none&quot;);
		mouse_original_path.setAttribute(&quot;id&quot;, &quot;path &quot; + Date());
		mouse_original_path.setAttribute(&quot;d&quot;, &quot;M&quot; + p.x + &quot;,&quot; + p.y);
		slides[activeSlide][&quot;original_element&quot;].appendChild(mouse_original_path);
		history_original_elements.push(mouse_original_path);

		mouse_presentation_path = document.createElementNS(NSS[&quot;svg&quot;], &quot;path&quot;);
		mouse_presentation_path.setAttribute(&quot;stroke&quot;, path_colour);
		mouse_presentation_path.setAttribute(&quot;stroke-width&quot;, path_paint_width);
		mouse_presentation_path.setAttribute(&quot;fill&quot;, &quot;none&quot;);
		mouse_presentation_path.setAttribute(&quot;id&quot;, &quot;path &quot; + Date() + &quot; presentation copy&quot;);
		mouse_presentation_path.setAttribute(&quot;d&quot;, &quot;M&quot; + p.x + &quot;,&quot; + p.y);

		if (slides[activeSlide][&quot;viewGroup&quot;])
			slides[activeSlide][&quot;viewGroup&quot;].appendChild(mouse_presentation_path);
		else
			slides[activeSlide][&quot;element&quot;].appendChild(mouse_presentation_path);

		history_presentation_elements.push(mouse_presentation_path);

		return false;
	}

	return true;
}

/** Event handler for mouse up in drawing mode.
 *
 *  @param e the event
 */
function drawingMouseup(e)
{
	if(!e)
		e = window.event;

	if (mouse_presentation_path != null)
	{
		var p = calcCoord(e);
		var d = mouse_presentation_path.getAttribute(&quot;d&quot;);
		d += &quot; L&quot; + p.x + &quot;,&quot; + p.y;
		mouse_presentation_path.setAttribute(&quot;d&quot;, d);
		mouse_presentation_path = null;
		mouse_original_path.setAttribute(&quot;d&quot;, d);
		mouse_original_path = null;

		return false;
	}

	return true;
}

/** Event handler for mouse move in drawing mode.
 *
 *  @param e the event
 */
function drawingMousemove(e)
{
	if(!e)
		e = window.event;

	var dist = (mouse_last_x - e.clientX) * (mouse_last_x - e.clientX) + (mouse_last_y - e.clientY) * (mouse_last_y - e.clientY);

	if (mouse_presentation_path == null)
	{
		return true;
	}

	if (dist &gt;= mouse_min_dist_sqr)
	{
		var p = calcCoord(e);
		var d = mouse_presentation_path.getAttribute(&quot;d&quot;);
		d += &quot; L&quot; + p.x + &quot;,&quot; + p.y;
		mouse_presentation_path.setAttribute(&quot;d&quot;, d);
		mouse_original_path.setAttribute(&quot;d&quot;, d);
		mouse_last_x = e.clientX;
		mouse_last_y = e.clientY;
	}

	return false;
}

/** Event handler for mouse wheel events in slide mode.
 *  based on http://adomas.org/javascript-mouse-wheel/
 *
 *  @param e the event
 */
function slideMousewheel(e)
{
	var delta = 0;

	if (!e)
		e = window.event;

	if (e.wheelDelta)
	{ // IE Opera
		delta = e.wheelDelta/120;
	}
	else if (e.detail)
	{ // MOZ
		delta = -e.detail/3;
	}

	if (delta &gt; 0)
		skipEffects(-1);
	else if (delta &lt; 0)
		skipEffects(1);

	if (e.preventDefault)
		e.preventDefault();

	e.returnValue = false;
}

/** Event handler for mouse wheel events in index mode.
 *  based on http://adomas.org/javascript-mouse-wheel/
 *
 *  @param e the event
 */
function indexMousewheel(e)
{
	var delta = 0;

	if (!e)
		e = window.event;

	if (e.wheelDelta)
	{ // IE Opera
		delta = e.wheelDelta/120;
	}
	else if (e.detail)
	{ // MOZ
		delta = -e.detail/3;
	}

	if (delta &gt; 0)
		indexSetPageSlide(activeSlide - INDEX_COLUMNS * INDEX_COLUMNS);
	else if (delta &lt; 0)
		indexSetPageSlide(activeSlide + INDEX_COLUMNS * INDEX_COLUMNS);

	if (e.preventDefault)
		e.preventDefault();

	e.returnValue = false;
}

/** Function to set the path paint width.
*/
function set_path_paint_width()
{
	var svgPoint1 = document.documentElement.createSVGPoint();
	var svgPoint2 = document.documentElement.createSVGPoint();

	svgPoint1.x = 0.0;
	svgPoint1.y = 0.0;
	svgPoint2.x = 1.0;
	svgPoint2.y = 0.0;

	var matrix = slides[activeSlide][&quot;element&quot;].getTransformToElement(ROOT_NODE);

	if (slides[activeSlide][&quot;viewGroup&quot;])
		matrix = slides[activeSlide][&quot;viewGroup&quot;].getTransformToElement(ROOT_NODE);

	svgPoint1 = svgPoint1.matrixTransform(matrix);
	svgPoint2 = svgPoint2.matrixTransform(matrix);

	path_paint_width = path_width / Math.sqrt((svgPoint2.x - svgPoint1.x) * (svgPoint2.x - svgPoint1.x) + (svgPoint2.y - svgPoint1.y) * (svgPoint2.y - svgPoint1.y));
}

/** The view effect.
 *
 *  @param dir direction the effect should be played (1 = forwards, -1 = backwards)
 *  @param element the element the effect should be applied to
 *  @param time the time that has elapsed since the beginning of the effect
 *  @param options a dictionary with additional options (e.g. length of the effect); for the view effect the options need to contain the old and the new matrix.
 */
function view(dir, element, time, options)
{
	var length = 250;
	var fraction;

	if (!options[&quot;matrixInitial&quot;])
	{
		var tempString = slides[activeSlide][&quot;viewGroup&quot;].getAttribute(&quot;transform&quot;);

		if (tempString)
			options[&quot;matrixInitial&quot;] = (new matrixSVG()).fromAttribute(tempString);
		else
			options[&quot;matrixInitial&quot;] = (new matrixSVG()).fromSVGElements(1, 0, 0, 1, 0, 0);
	}

	if ((time == STATE_END) || (time == STATE_START))
		fraction = 1;
	else
	{
		if (options &amp;&amp; options[&quot;length&quot;])
			length = options[&quot;length&quot;];

		fraction = time / length;
	}

	if (dir == 1)
	{
		if (fraction &lt;= 0)
		{
			element.setAttribute(&quot;transform&quot;, options[&quot;matrixInitial&quot;].toAttribute());
		}
		else if (fraction &gt;= 1)
		{
			element.setAttribute(&quot;transform&quot;, options[&quot;matrixNew&quot;].toAttribute());

			set_path_paint_width();

			options[&quot;matrixInitial&quot;] = null;
			return true;
		}
		else
		{
			element.setAttribute(&quot;transform&quot;, options[&quot;matrixInitial&quot;].mix(options[&quot;matrixNew&quot;], fraction).toAttribute());
		}
	}
	else if (dir == -1)
	{
		if (fraction &lt;= 0)
		{
			element.setAttribute(&quot;transform&quot;, options[&quot;matrixInitial&quot;].toAttribute());
		}
		else if (fraction &gt;= 1)
		{
			element.setAttribute(&quot;transform&quot;, options[&quot;matrixOld&quot;].toAttribute());
			set_path_paint_width();

			options[&quot;matrixInitial&quot;] = null;
			return true;
		}
		else
		{
			element.setAttribute(&quot;transform&quot;, options[&quot;matrixInitial&quot;].mix(options[&quot;matrixOld&quot;], fraction).toAttribute());
		}
	}

	return false;
}

/** The fade effect.
 *
 *  @param dir direction the effect should be played (1 = forwards, -1 = backwards)
 *  @param element the element the effect should be applied to
 *  @param time the time that has elapsed since the beginning of the effect
 *  @param options a dictionary with additional options (e.g. length of the effect)
 */
function fade(dir, element, time, options)
{
	var length = 250;
	var fraction;

	if ((time == STATE_END) || (time == STATE_START))
		fraction = 1;
	else
	{
		if (options &amp;&amp; options[&quot;length&quot;])
			length = options[&quot;length&quot;];

		fraction = time / length;
	}

	if (dir == 1)
	{
		if (fraction &lt;= 0)
		{
			element.style.display = &quot;none&quot;;
			element.setAttribute(&quot;opacity&quot;, 0);
		}
		else if (fraction &gt;= 1)
		{
			element.style.display = &quot;inherit&quot;;
			element.setAttribute(&quot;opacity&quot;, 1);
			return true;
		}
		else
		{
			element.style.display = &quot;inherit&quot;;
			element.setAttribute(&quot;opacity&quot;, fraction);
		}
	}
	else if (dir == -1)
	{
		if (fraction &lt;= 0)
		{
			element.style.display = &quot;inherit&quot;;
			element.setAttribute(&quot;opacity&quot;, 1);
		}
		else if (fraction &gt;= 1)
		{
			element.setAttribute(&quot;opacity&quot;, 0);
			element.style.display = &quot;none&quot;;
			return true;
		}
		else
		{
			element.style.display = &quot;inherit&quot;;
			element.setAttribute(&quot;opacity&quot;, 1 - fraction);
		}
	}
	return false;
}

/** The appear effect.
 *
 *  @param dir direction the effect should be played (1 = forwards, -1 = backwards)
 *  @param element the element the effect should be applied to
 *  @param time the time that has elapsed since the beginning of the effect
 *  @param options a dictionary with additional options (e.g. length of the effect)
 */
function appear(dir, element, time, options)
{
	if (dir == 1)
	{
		element.style.display = &quot;inherit&quot;;
		element.setAttribute(&quot;opacity&quot;,1);
	}
	else if (dir == -1)
	{
		element.style.display = &quot;none&quot;;
		element.setAttribute(&quot;opacity&quot;,0);
	}
	return true;
}

/** The pop effect.
 *
 *  @param dir direction the effect should be played (1 = forwards, -1 = backwards)
 *  @param element the element the effect should be applied to
 *  @param time the time that has elapsed since the beginning of the effect
 *  @param options a dictionary with additional options (e.g. length of the effect)
 */
function pop(dir, element, time, options)
{
	var length = 500;
	var fraction;

	if ((time == STATE_END) || (time == STATE_START))
		fraction = 1;
	else
	{
		if (options &amp;&amp; options[&quot;length&quot;])
			length = options[&quot;length&quot;];

		fraction = time / length;
	}

	if (dir == 1)
	{
		if (fraction &lt;= 0)
		{
			element.setAttribute(&quot;opacity&quot;, 0);
			element.setAttribute(&quot;transform&quot;, &quot;scale(0)&quot;);
			element.style.display = &quot;none&quot;;
		}
		else if (fraction &gt;= 1)
		{
			element.setAttribute(&quot;opacity&quot;, 1);
			element.removeAttribute(&quot;transform&quot;);
			element.style.display = &quot;inherit&quot;;
			return true;
		}
		else
		{
			element.style.display = &quot;inherit&quot;;
			var opacityFraction = fraction * 3;
			if (opacityFraction &gt; 1)
				opacityFraction = 1;
			element.setAttribute(&quot;opacity&quot;, opacityFraction);
			var offsetX = WIDTH * (1.0 - fraction) / 2.0;
			var offsetY = HEIGHT * (1.0 - fraction) / 2.0;
			element.setAttribute(&quot;transform&quot;, &quot;translate(&quot; + offsetX + &quot;,&quot; + offsetY + &quot;) scale(&quot; + fraction + &quot;)&quot;);
		}
	}
	else if (dir == -1)
	{
		if (fraction &lt;= 0)
		{
			element.setAttribute(&quot;opacity&quot;, 1);
			element.setAttribute(&quot;transform&quot;, &quot;scale(1)&quot;);
			element.style.display = &quot;inherit&quot;;
		}
		else if (fraction &gt;= 1)
		{
			element.setAttribute(&quot;opacity&quot;, 0);
			element.removeAttribute(&quot;transform&quot;);
			element.style.display = &quot;none&quot;;
			return true;
		}
		else
		{
			element.setAttribute(&quot;opacity&quot;, 1 - fraction);
			element.setAttribute(&quot;transform&quot;, &quot;scale(&quot; + 1 - fraction + &quot;)&quot;);
			element.style.display = &quot;inherit&quot;;
		}
	}
	return false;
}

/** Function to set a slide either to the start or the end state.
 *  
 *  @param slide the slide to use
 *  @param state the state into which the slide should be set
 */
function setSlideToState(slide, state)
{
	slides[slide][&quot;viewGroup&quot;].setAttribute(&quot;transform&quot;, slides[slide].initialView);

	if (slides[slide][&quot;effects&quot;])
	{	
		if (state == STATE_END)
		{
			for (var counter = 0; counter &lt; slides[slide][&quot;effects&quot;].length; counter++)
			{
				for (var subCounter = 0; subCounter &lt; slides[slide][&quot;effects&quot;][counter].length; subCounter++)
				{
					var effect = slides[slide][&quot;effects&quot;][counter][subCounter];
					if (effect[&quot;effect&quot;] == &quot;fade&quot;)
						fade(effect[&quot;dir&quot;], effect[&quot;element&quot;], STATE_END, effect[&quot;options&quot;]);	
					else if (effect[&quot;effect&quot;] == &quot;appear&quot;)
						appear(effect[&quot;dir&quot;], effect[&quot;element&quot;], STATE_END, effect[&quot;options&quot;]);	
					else if (effect[&quot;effect&quot;] == &quot;pop&quot;)
						pop(effect[&quot;dir&quot;], effect[&quot;element&quot;], STATE_END, effect[&quot;options&quot;]);	
					else if (effect[&quot;effect&quot;] == &quot;view&quot;)
						view(effect[&quot;dir&quot;], effect[&quot;element&quot;], STATE_END, effect[&quot;options&quot;]);	
				}
			}
		}
		else if (state == STATE_START)
		{
			for (var counter = slides[slide][&quot;effects&quot;].length - 1; counter &gt;= 0; counter--)
			{
				for (var subCounter = 0; subCounter &lt; slides[slide][&quot;effects&quot;][counter].length; subCounter++)
				{
					var effect = slides[slide][&quot;effects&quot;][counter][subCounter];
					if (effect[&quot;effect&quot;] == &quot;fade&quot;)
						fade(parseInt(effect[&quot;dir&quot;]) * -1, effect[&quot;element&quot;], STATE_START, effect[&quot;options&quot;]);	
					else if (effect[&quot;effect&quot;] == &quot;appear&quot;)
						appear(parseInt(effect[&quot;dir&quot;]) * -1, effect[&quot;element&quot;], STATE_START, effect[&quot;options&quot;]);	
					else if (effect[&quot;effect&quot;] == &quot;pop&quot;)
						pop(parseInt(effect[&quot;dir&quot;]) * -1, effect[&quot;element&quot;], STATE_START, effect[&quot;options&quot;]);	
					else if (effect[&quot;effect&quot;] == &quot;view&quot;)
						view(parseInt(effect[&quot;dir&quot;]) * -1, effect[&quot;element&quot;], STATE_START, effect[&quot;options&quot;]);	
				}
			}
		}
		else
		{
			setSlideToState(slide, STATE_START);

			for (var counter = 0; counter &lt; slides[slide][&quot;effects&quot;].length &amp;&amp; counter &lt; state; counter++)
			{
				for (var subCounter = 0; subCounter &lt; slides[slide][&quot;effects&quot;][counter].length; subCounter++)
				{
					var effect = slides[slide][&quot;effects&quot;][counter][subCounter];
					if (effect[&quot;effect&quot;] == &quot;fade&quot;)
						fade(effect[&quot;dir&quot;], effect[&quot;element&quot;], STATE_END, effect[&quot;options&quot;]);	
					else if (effect[&quot;effect&quot;] == &quot;appear&quot;)
						appear(effect[&quot;dir&quot;], effect[&quot;element&quot;], STATE_END, effect[&quot;options&quot;]);	
					else if (effect[&quot;effect&quot;] == &quot;pop&quot;)
						pop(effect[&quot;dir&quot;], effect[&quot;element&quot;], STATE_END, effect[&quot;options&quot;]);	
					else if (effect[&quot;effect&quot;] == &quot;view&quot;)
						view(effect[&quot;dir&quot;], effect[&quot;element&quot;], STATE_END, effect[&quot;options&quot;]);	
				}
			}
		}
	}

	window.location.hash = (activeSlide + 1) + '_' + activeEffect;
}

/** Convenience function to translate a attribute string into a dictionary.
 *
 *	@param str the attribute string
 *  @return a dictionary
 *  @see dictToPropStr
 */
function propStrToDict(str)
{
	var list = str.split(&quot;;&quot;);
	var obj = new Object();

	for (var counter = 0; counter &lt; list.length; counter++)
	{
		var subStr = list[counter];
		var subList = subStr.split(&quot;:&quot;);
		if (subList.length == 2)
		{
			obj[subList[0]] = subList[1];
		}	
	}

	return obj;
}

/** Convenience function to translate a dictionary into a string that can be used as an attribute.
 *
 *  @param dict the dictionary to convert
 *  @return a string that can be used as an attribute
 *  @see propStrToDict
 */
function dictToPropStr(dict)
{
	var str = &quot;&quot;;

	for (var key in dict)
	{
		str += key + &quot;:&quot; + dict[key] + &quot;;&quot;;
	}

	return str;
}

/** Sub-function to add a suffix to the ids of the node and all its children.
 *	
 *	@param node the node to change
 *	@param suffix the suffix to add
 *	@param replace dictionary of replaced ids
 *  @see suffixNodeIds
 */
function suffixNoneIds_sub(node, suffix, replace)
{
	if (node.nodeType == 1)
	{
		if (node.getAttribute(&quot;id&quot;))
		{
			var id = node.getAttribute(&quot;id&quot;)
				replace[&quot;#&quot; + id] = id + suffix;
			node.setAttribute(&quot;id&quot;, id + suffix);
		}

		if ((node.nodeName == &quot;use&quot;) &amp;&amp; (node.getAttributeNS(NSS[&quot;xlink&quot;], &quot;href&quot;)) &amp;&amp; (replace[node.getAttribute(NSS[&quot;xlink&quot;], &quot;href&quot;)]))
			node.setAttribute(NSS[&quot;xlink&quot;], &quot;href&quot;, node.getAttribute(NSS[&quot;xlink&quot;], &quot;href&quot;) + suffix);

		if (node.childNodes)
		{
			for (var counter = 0; counter &lt; node.childNodes.length; counter++)
				suffixNoneIds_sub(node.childNodes[counter], suffix, replace);
		}
	}
}

/** Function to add a suffix to the ids of the node and all its children.
 *	
 *	@param node the node to change
 *	@param suffix the suffix to add
 *  @return the changed node
 *  @see suffixNodeIds_sub
 */
function suffixNodeIds(node, suffix)
{
	var replace = new Object();

	suffixNoneIds_sub(node, suffix, replace);

	return node;
}

/** Function to build a progress bar.
 *	
 *  @param parent node to attach the progress bar to
 */
function createProgressBar(parent_node)
{
	var g = document.createElementNS(NSS[&quot;svg&quot;], &quot;g&quot;);
	g.setAttribute(&quot;clip-path&quot;, &quot;url(#jessyInkSlideClipPath)&quot;);
	g.setAttribute(&quot;id&quot;, &quot;layer_progress_bar&quot;);
	g.setAttribute(&quot;style&quot;, &quot;display: none;&quot;);

	var rect_progress_bar = document.createElementNS(NSS[&quot;svg&quot;], &quot;rect&quot;);
	rect_progress_bar.setAttribute(&quot;style&quot;, &quot;marker: none; fill: rgb(128, 128, 128); stroke: none;&quot;);
	rect_progress_bar.setAttribute(&quot;id&quot;, &quot;rect_progress_bar&quot;);
	rect_progress_bar.setAttribute(&quot;x&quot;, 0);
	rect_progress_bar.setAttribute(&quot;y&quot;, 0.99 * HEIGHT);
	rect_progress_bar.setAttribute(&quot;width&quot;, 0);
	rect_progress_bar.setAttribute(&quot;height&quot;, 0.01 * HEIGHT);
	g.appendChild(rect_progress_bar);

	var circle_timer_indicator = document.createElementNS(NSS[&quot;svg&quot;], &quot;circle&quot;);
	circle_timer_indicator.setAttribute(&quot;style&quot;, &quot;marker: none; fill: rgb(255, 0, 0); stroke: none;&quot;);
	circle_timer_indicator.setAttribute(&quot;id&quot;, &quot;circle_timer_indicator&quot;);
	circle_timer_indicator.setAttribute(&quot;cx&quot;, 0.005 * HEIGHT);
	circle_timer_indicator.setAttribute(&quot;cy&quot;, 0.995 * HEIGHT);
	circle_timer_indicator.setAttribute(&quot;r&quot;, 0.005 * HEIGHT);
	g.appendChild(circle_timer_indicator);

	parent_node.appendChild(g);
}

/** Function to hide the progress bar.
 *	
 */
function hideProgressBar()
{
	var progress_bar = document.getElementById(&quot;layer_progress_bar&quot;);

	if (!progress_bar)
	{
		return;
	}

	progress_bar.setAttribute(&quot;style&quot;, &quot;display: none;&quot;);
}

/** Function to show the progress bar.
 *	
 */
function showProgressBar()
{
	var progress_bar = document.getElementById(&quot;layer_progress_bar&quot;);

	if (!progress_bar)
	{
		return;
	}

	progress_bar.setAttribute(&quot;style&quot;, &quot;display: inherit;&quot;);
}

/** Set progress bar value.
 *	
 *	@param value the current slide number
 *
 */
function setProgressBarValue(value)
{
	var rect_progress_bar = document.getElementById(&quot;rect_progress_bar&quot;);

	if (!rect_progress_bar)
	{
		return;
	}

	if (value &lt; 1)
	{
		// First slide, assumed to be the title of the presentation
		var x = 0;
		var w = 0.01 * HEIGHT;
	}
	else if (value &gt;= slides.length - 1)
	{
		// Last slide, assumed to be the end of the presentation
		var x = WIDTH - 0.01 * HEIGHT;
		var w = 0.01 * HEIGHT;
	}
	else
	{
		value -= 1;
		value /= (slides.length - 2);

		var x = WIDTH * value;
		var w = WIDTH / (slides.length - 2);
	}

	rect_progress_bar.setAttribute(&quot;x&quot;, x);
	rect_progress_bar.setAttribute(&quot;width&quot;, w);
}

/** Set time indicator.
 *	
 *	@param value the percentage of time elapse so far between 0.0 and 1.0
 *
 */
function setTimeIndicatorValue(value)
{
	var circle_timer_indicator = document.getElementById(&quot;circle_timer_indicator&quot;);

	if (!circle_timer_indicator)
	{
		return;
	}

	if (value &lt; 0.0)
	{
		value = 0.0;
	}

	if (value &gt; 1.0)
	{
		value = 1.0;
	}

	var cx = (WIDTH - 0.01 * HEIGHT) * value + 0.005 * HEIGHT;
	circle_timer_indicator.setAttribute(&quot;cx&quot;, cx);
}

/** Update timer.
 *	
 */
function updateTimer()
{
	timer_elapsed += 1;
	setTimeIndicatorValue((timer_elapsed - timer_start) / (60 * timer_duration));
}

/** Convert screen coordinates to document coordinates.
 *
 *  @param e event with screen coordinates
 *
 *  @return coordinates in SVG file coordinate system	
 */
function calcCoord(e)
{
	var svgPoint = document.documentElement.createSVGPoint();
	svgPoint.x = e.clientX + window.pageXOffset;
	svgPoint.y = e.clientY + window.pageYOffset;

	var matrix = slides[activeSlide][&quot;element&quot;].getScreenCTM();

	if (slides[activeSlide][&quot;viewGroup&quot;])
		matrix = slides[activeSlide][&quot;viewGroup&quot;].getScreenCTM();

	svgPoint = svgPoint.matrixTransform(matrix.inverse());
	return svgPoint;
}

/** Add slide.
 *
 *	@param after_slide after which slide the new slide should be inserted into the presentation
 */
function addSlide(after_slide)
{
	number_of_added_slides++;

	var g = document.createElementNS(NSS[&quot;svg&quot;], &quot;g&quot;);
	g.setAttribute(&quot;clip-path&quot;, &quot;url(#jessyInkSlideClipPath)&quot;);
	g.setAttribute(&quot;id&quot;, &quot;Whiteboard &quot; + Date() + &quot; presentation copy&quot;);
	g.setAttribute(&quot;style&quot;, &quot;display: none;&quot;);

	var new_slide = new Object();
	new_slide[&quot;element&quot;] = g;

	// Set build in transition.
	new_slide[&quot;transitionIn&quot;] = new Object();
	var dict = defaultTransitionInDict;
	new_slide[&quot;transitionIn&quot;][&quot;name&quot;] = dict[&quot;name&quot;];
	new_slide[&quot;transitionIn&quot;][&quot;options&quot;] = new Object();

	for (key in dict)
		if (key != &quot;name&quot;)
			new_slide[&quot;transitionIn&quot;][&quot;options&quot;][key] = dict[key];

	// Set build out transition.
	new_slide[&quot;transitionOut&quot;] = new Object();
	dict = defaultTransitionOutDict;
	new_slide[&quot;transitionOut&quot;][&quot;name&quot;] = dict[&quot;name&quot;];
	new_slide[&quot;transitionOut&quot;][&quot;options&quot;] = new Object();

	for (key in dict)
		if (key != &quot;name&quot;)
			new_slide[&quot;transitionOut&quot;][&quot;options&quot;][key] = dict[key];

	// Copy master slide content.
	if (masterSlide)
	{
		var clonedNode = suffixNodeIds(masterSlide.cloneNode(true), &quot;_&quot; + Date() + &quot; presentation_copy&quot;);
		clonedNode.removeAttributeNS(NSS[&quot;inkscape&quot;], &quot;groupmode&quot;);
		clonedNode.removeAttributeNS(NSS[&quot;inkscape&quot;], &quot;label&quot;);
		clonedNode.style.display = &quot;inherit&quot;;

		g.appendChild(clonedNode);
	}

	// Substitute auto texts.
	substituteAutoTexts(g, &quot;Whiteboard &quot; + number_of_added_slides, &quot;W&quot; + number_of_added_slides, slides.length);

	g.setAttribute(&quot;onmouseover&quot;, &quot;if ((currentMode == INDEX_MODE) &amp;&amp; ( activeSlide != &quot; + (after_slide + 1) + &quot;)) { indexSetActiveSlide(&quot; + (after_slide + 1) + &quot;); };&quot;);

	// Create a transform group.
	var transformGroup = document.createElementNS(NSS[&quot;svg&quot;], &quot;g&quot;);

	// Add content to transform group.
	while (g.firstChild)
		transformGroup.appendChild(g.firstChild);

	// Transfer the transform attribute from the node to the transform group.
	if (g.getAttribute(&quot;transform&quot;))
	{
		transformGroup.setAttribute(&quot;transform&quot;, g.getAttribute(&quot;transform&quot;));
		g.removeAttribute(&quot;transform&quot;);
	}

	// Create a view group.
	var viewGroup = document.createElementNS(NSS[&quot;svg&quot;], &quot;g&quot;);

	viewGroup.appendChild(transformGroup);
	new_slide[&quot;viewGroup&quot;] = g.appendChild(viewGroup);

	// Insert background.
	if (BACKGROUND_COLOR != null)
	{
		var rectNode = document.createElementNS(NSS[&quot;svg&quot;], &quot;rect&quot;);

		rectNode.setAttribute(&quot;x&quot;, 0);
		rectNode.setAttribute(&quot;y&quot;, 0);
		rectNode.setAttribute(&quot;width&quot;, WIDTH);
		rectNode.setAttribute(&quot;height&quot;, HEIGHT);
		rectNode.setAttribute(&quot;id&quot;, &quot;jessyInkBackground&quot; + Date());
		rectNode.setAttribute(&quot;fill&quot;, BACKGROUND_COLOR);

		new_slide[&quot;viewGroup&quot;].insertBefore(rectNode, new_slide[&quot;viewGroup&quot;].firstChild);
	}

	// Set initial view even if there are no other views.
	var matrixOld = (new matrixSVG()).fromElements(1, 0, 0, 0, 1, 0, 0, 0, 1);

	new_slide[&quot;viewGroup&quot;].setAttribute(&quot;transform&quot;, matrixOld.toAttribute());
	new_slide.initialView = matrixOld.toAttribute();

	// Insert slide
	var node = slides[after_slide][&quot;element&quot;];
	var next_node = node.nextSibling;
	var parent_node = node.parentNode;

	if (next_node)
	{
		parent_node.insertBefore(g, next_node);
	}
	else
	{
		parent_node.appendChild(g);
	}

	g = document.createElementNS(NSS[&quot;svg&quot;], &quot;g&quot;);
	g.setAttributeNS(NSS[&quot;inkscape&quot;], &quot;groupmode&quot;, &quot;layer&quot;);
	g.setAttributeNS(NSS[&quot;inkscape&quot;], &quot;label&quot;, &quot;Whiteboard &quot; + number_of_added_slides);
	g.setAttribute(&quot;clip-path&quot;, &quot;url(#jessyInkSlideClipPath)&quot;);
	g.setAttribute(&quot;id&quot;, &quot;Whiteboard &quot; + Date());
	g.setAttribute(&quot;style&quot;, &quot;display: none;&quot;);

	new_slide[&quot;original_element&quot;] = g;

	node = slides[after_slide][&quot;original_element&quot;];
	next_node = node.nextSibling;
	parent_node = node.parentNode;

	if (next_node)
	{
		parent_node.insertBefore(g, next_node);
	}
	else
	{
		parent_node.appendChild(g);
	}

	before_new_slide = slides.slice(0, after_slide + 1);
	after_new_slide = slides.slice(after_slide + 1);
	slides = before_new_slide.concat(new_slide, after_new_slide);

	//resetting the counter attributes on the slides that follow the new slide...
	for (var counter = after_slide+2; counter &lt; slides.length; counter++)
	{
		slides[counter][&quot;element&quot;].setAttribute(&quot;onmouseover&quot;, &quot;if ((currentMode == INDEX_MODE) &amp;&amp; ( activeSlide != &quot; + counter + &quot;)) { indexSetActiveSlide(&quot; + counter + &quot;); };&quot;);
	}
}

/** Convenience function to obtain a transformation matrix from a point matrix.
 *
 *	@param mPoints Point matrix.
 *	@return A transformation matrix.
 */
function pointMatrixToTransformation(mPoints)
{
	mPointsOld = (new matrixSVG()).fromElements(0, WIDTH, WIDTH, 0, 0, HEIGHT, 1, 1, 1);

	return mPointsOld.mult(mPoints.inv());
}

/** Convenience function to obtain a matrix with three corners of a rectangle.
 *
 *	@param rect an svg rectangle
 *	@return a matrixSVG containing three corners of the rectangle
 */
function rectToMatrix(rect)
{
	rectWidth = rect.getBBox().width;
	rectHeight = rect.getBBox().height;
	rectX = rect.getBBox().x;
	rectY = rect.getBBox().y;
	rectXcorr = 0;
	rectYcorr = 0;

	scaleX = WIDTH / rectWidth;
	scaleY = HEIGHT / rectHeight;

	if (scaleX &gt; scaleY)
	{
		scaleX = scaleY;
		rectXcorr -= (WIDTH / scaleX - rectWidth) / 2;
		rectWidth = WIDTH / scaleX;
	}	
	else
	{
		scaleY = scaleX;
		rectYcorr -= (HEIGHT / scaleY - rectHeight) / 2;
		rectHeight = HEIGHT / scaleY;
	}

	if (rect.transform.baseVal.numberOfItems &lt; 1)
	{
		mRectTrans = (new matrixSVG()).fromElements(1, 0, 0, 0, 1, 0, 0, 0, 1);
	}
	else
	{
		mRectTrans = (new matrixSVG()).fromSVGMatrix(rect.transform.baseVal.consolidate().matrix);
	}

	newBasePoints = (new matrixSVG()).fromElements(rectX, rectX, rectX, rectY, rectY, rectY, 1, 1, 1);
	newVectors = (new matrixSVG()).fromElements(rectXcorr, rectXcorr + rectWidth, rectXcorr + rectWidth, rectYcorr, rectYcorr, rectYcorr + rectHeight, 0, 0, 0);

	return mRectTrans.mult(newBasePoints.add(newVectors));
}

/** Function to handle JessyInk elements.
 *
 *	@param	node	Element node.
 */
function handleElement(node)
{
	if (node.getAttributeNS(NSS['jessyink'], 'element') == 'core.video')
	{
		var url;
		var width;
		var height;
		var x;
		var y;
		var transform;

		var tspans = node.getElementsByTagNameNS(&quot;http://www.w3.org/2000/svg&quot;, &quot;tspan&quot;);

		for (var tspanCounter = 0; tspanCounter &lt; tspans.length; tspanCounter++)
		{
			if (tspans[tspanCounter].getAttributeNS(&quot;https://launchpad.net/jessyink&quot;, &quot;video&quot;) == &quot;url&quot;)
			{
				url = tspans[tspanCounter].firstChild.nodeValue;
			}
		}

		var rects = node.getElementsByTagNameNS(&quot;http://www.w3.org/2000/svg&quot;, &quot;rect&quot;);

		for (var rectCounter = 0; rectCounter &lt; rects.length; rectCounter++)
		{
			if (rects[rectCounter].getAttributeNS(&quot;https://launchpad.net/jessyink&quot;, &quot;video&quot;) == &quot;rect&quot;)
			{
				x = rects[rectCounter].getAttribute(&quot;x&quot;);
				y = rects[rectCounter].getAttribute(&quot;y&quot;);
				width = rects[rectCounter].getAttribute(&quot;width&quot;);
				height = rects[rectCounter].getAttribute(&quot;height&quot;);
				transform = rects[rectCounter].getAttribute(&quot;transform&quot;);
			}
		}

		for (var childCounter = 0; childCounter &lt; node.childNodes.length; childCounter++)
		{
			if (node.childNodes[childCounter].nodeType == 1)
			{
				if (node.childNodes[childCounter].style)
				{
					node.childNodes[childCounter].style.display = 'none';
				}
				else
				{
					node.childNodes[childCounter].setAttribute(&quot;style&quot;, &quot;display: none;&quot;);
				}
			}
		}

		var foreignNode = document.createElementNS(&quot;http://www.w3.org/2000/svg&quot;, &quot;foreignObject&quot;);
		foreignNode.setAttribute(&quot;x&quot;, x);
		foreignNode.setAttribute(&quot;y&quot;, y);
		foreignNode.setAttribute(&quot;width&quot;, width);
		foreignNode.setAttribute(&quot;height&quot;, height);
		foreignNode.setAttribute(&quot;transform&quot;, transform);

		var videoNode = document.createElementNS(&quot;http://www.w3.org/1999/xhtml&quot;, &quot;video&quot;);
		videoNode.setAttribute(&quot;src&quot;, url);

		foreignNode.appendChild(videoNode);
		node.appendChild(foreignNode);
	}
}

/** Class processing the location hash.
 *
 *	@param str location hash
 */
function LocationHash(str)
{
	this.slideNumber = 0;
	this.effectNumber = 0;

	str = str.substr(1, str.length - 1);

	var parts = str.split('_');

	// Try to extract slide number.
	if (parts.length &gt;= 1)
	{
		try
		{
			var slideNumber = parseInt(parts[0]);

			if (!isNaN(slideNumber))
			{
				this.slideNumber = slideNumber - 1;
			}
		}
		catch (e)
		{
		}
	}
	
	// Try to extract effect number.
	if (parts.length &gt;= 2)
	{
		try
		{
			var effectNumber = parseInt(parts[1]);

			if (!isNaN(effectNumber))
			{
				this.effectNumber = effectNumber;
			}
		}
		catch (e)
		{
		}
	}
}

/** Class representing an svg matrix.
*/
function matrixSVG()
{
	this.e11 = 0; // a
	this.e12 = 0; // c
	this.e13 = 0; // e
	this.e21 = 0; // b
	this.e22 = 0; // d
	this.e23 = 0; // f
	this.e31 = 0;
	this.e32 = 0;
	this.e33 = 0;
}

/** Constructor function.
 *
 *	@param a element a (i.e. 1, 1) as described in the svg standard.
 *	@param b element b (i.e. 2, 1) as described in the svg standard.
 *	@param c element c (i.e. 1, 2) as described in the svg standard.
 *	@param d element d (i.e. 2, 2) as described in the svg standard.
 *	@param e element e (i.e. 1, 3) as described in the svg standard.
 *	@param f element f (i.e. 2, 3) as described in the svg standard.
 */
matrixSVG.prototype.fromSVGElements = function(a, b, c, d, e, f)
{
	this.e11 = a;
	this.e12 = c;
	this.e13 = e;
	this.e21 = b;
	this.e22 = d;
	this.e23 = f;
	this.e31 = 0;
	this.e32 = 0;
	this.e33 = 1;

	return this;
}

/** Constructor function.
 *
 *	@param matrix an svg matrix as described in the svg standard.
 */
matrixSVG.prototype.fromSVGMatrix = function(m)
{
	this.e11 = m.a;
	this.e12 = m.c;
	this.e13 = m.e;
	this.e21 = m.b;
	this.e22 = m.d;
	this.e23 = m.f;
	this.e31 = 0;
	this.e32 = 0;
	this.e33 = 1;

	return this;
}

/** Constructor function.
 *
 *	@param e11 element 1, 1 of the matrix.
 *	@param e12 element 1, 2 of the matrix.
 *	@param e13 element 1, 3 of the matrix.
 *	@param e21 element 2, 1 of the matrix.
 *	@param e22 element 2, 2 of the matrix.
 *	@param e23 element 2, 3 of the matrix.
 *	@param e31 element 3, 1 of the matrix.
 *	@param e32 element 3, 2 of the matrix.
 *	@param e33 element 3, 3 of the matrix.
 */
matrixSVG.prototype.fromElements = function(e11, e12, e13, e21, e22, e23, e31, e32, e33)
{
	this.e11 = e11;
	this.e12 = e12;
	this.e13 = e13;
	this.e21 = e21;
	this.e22 = e22;
	this.e23 = e23;
	this.e31 = e31;
	this.e32 = e32;
	this.e33 = e33;

	return this;
}

/** Constructor function.
 *
 *	@param attrString string value of the &quot;transform&quot; attribute (currently only &quot;matrix&quot; is accepted)
 */
matrixSVG.prototype.fromAttribute = function(attrString)
{
	str = attrString.substr(7, attrString.length - 8);

	str = str.trim();

	strArray = str.split(&quot;,&quot;);

	// Opera does not use commas to separate the values of the matrix, only spaces.
	if (strArray.length != 6)
		strArray = str.split(&quot; &quot;);

	this.e11 = parseFloat(strArray[0]);
	this.e21 = parseFloat(strArray[1]);
	this.e31 = 0;
	this.e12 = parseFloat(strArray[2]);
	this.e22 = parseFloat(strArray[3]);
	this.e32 = 0;
	this.e13 = parseFloat(strArray[4]);
	this.e23 = parseFloat(strArray[5]);
	this.e33 = 1;

	return this;
}

/** Output function
 *
 *	@return a string that can be used as the &quot;transform&quot; attribute.
 */
matrixSVG.prototype.toAttribute = function()
{
	return &quot;matrix(&quot; + this.e11 + &quot;, &quot; + this.e21 + &quot;, &quot; + this.e12 + &quot;, &quot; + this.e22 + &quot;, &quot; + this.e13 + &quot;, &quot; + this.e23 + &quot;)&quot;;
}

/** Matrix nversion.
 *
 *	@return the inverse of the matrix
 */
matrixSVG.prototype.inv = function()
{
	out = new matrixSVG();

	det = this.e11 * (this.e33 * this.e22 - this.e32 * this.e23) - this.e21 * (this.e33 * this.e12 - this.e32 * this.e13) + this.e31 * (this.e23 * this.e12 - this.e22 * this.e13);

	out.e11 =  (this.e33 * this.e22 - this.e32 * this.e23) / det;
	out.e12 = -(this.e33 * this.e12 - this.e32 * this.e13) / det;
	out.e13 =  (this.e23 * this.e12 - this.e22 * this.e13) / det;
	out.e21 = -(this.e33 * this.e21 - this.e31 * this.e23) / det;
	out.e22 =  (this.e33 * this.e11 - this.e31 * this.e13) / det;
	out.e23 = -(this.e23 * this.e11 - this.e21 * this.e13) / det;
	out.e31 =  (this.e32 * this.e21 - this.e31 * this.e22) / det;
	out.e32 = -(this.e32 * this.e11 - this.e31 * this.e12) / det;
	out.e33 =  (this.e22 * this.e11 - this.e21 * this.e12) / det;

	return out;
}

/** Matrix multiplication.
 *
 *	@param op another svg matrix
 *	@return this * op
 */
matrixSVG.prototype.mult = function(op)
{
	out = new matrixSVG();

	out.e11 = this.e11 * op.e11 + this.e12 * op.e21 + this.e13 * op.e31;
	out.e12 = this.e11 * op.e12 + this.e12 * op.e22 + this.e13 * op.e32;
	out.e13 = this.e11 * op.e13 + this.e12 * op.e23 + this.e13 * op.e33;
	out.e21 = this.e21 * op.e11 + this.e22 * op.e21 + this.e23 * op.e31;
	out.e22 = this.e21 * op.e12 + this.e22 * op.e22 + this.e23 * op.e32;
	out.e23 = this.e21 * op.e13 + this.e22 * op.e23 + this.e23 * op.e33;
	out.e31 = this.e31 * op.e11 + this.e32 * op.e21 + this.e33 * op.e31;
	out.e32 = this.e31 * op.e12 + this.e32 * op.e22 + this.e33 * op.e32;
	out.e33 = this.e31 * op.e13 + this.e32 * op.e23 + this.e33 * op.e33;

	return out;
}

/** Matrix addition.
 *
 *	@param op another svg matrix
 *	@return this + op
 */
matrixSVG.prototype.add = function(op)
{
	out = new matrixSVG();

	out.e11 = this.e11 + op.e11;
	out.e12 = this.e12 + op.e12;
	out.e13 = this.e13 + op.e13;
	out.e21 = this.e21 + op.e21;
	out.e22 = this.e22 + op.e22;
	out.e23 = this.e23 + op.e23;
	out.e31 = this.e31 + op.e31;
	out.e32 = this.e32 + op.e32;
	out.e33 = this.e33 + op.e33;

	return out;
}

/** Matrix mixing.
 *
 *	@param op another svg matrix
 *	@parma contribOp contribution of the other matrix (0 &lt;= contribOp &lt;= 1)
 *	@return (1 - contribOp) * this + contribOp * op
 */
matrixSVG.prototype.mix = function(op, contribOp)
{
	contribThis = 1.0 - contribOp;
	out = new matrixSVG();

	out.e11 = contribThis * this.e11 + contribOp * op.e11;
	out.e12 = contribThis * this.e12 + contribOp * op.e12;
	out.e13 = contribThis * this.e13 + contribOp * op.e13;
	out.e21 = contribThis * this.e21 + contribOp * op.e21;
	out.e22 = contribThis * this.e22 + contribOp * op.e22;
	out.e23 = contribThis * this.e23 + contribOp * op.e23;
	out.e31 = contribThis * this.e31 + contribOp * op.e31;
	out.e32 = contribThis * this.e32 + contribOp * op.e32;
	out.e33 = contribThis * this.e33 + contribOp * op.e33;

	return out;
}

/** Trimming function for strings.
*/
String.prototype.trim = function()
{
	return this.replace(/^\s+|\s+$/g, '');
}
