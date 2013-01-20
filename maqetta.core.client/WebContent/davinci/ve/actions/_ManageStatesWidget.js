define([
	"dojo/_base/declare",
	"dojo/dom-construct",
	"dojo/on",
	"dojo/dom-style",
	"dojo/dom-class",
	"dojo/_base/event",
	"dijit/_WidgetBase",
	"dijit/_TemplatedMixin",
	"dijit/_WidgetsInTemplateMixin",
	"davinci/Runtime",
	"davinci/Workbench",
	"davinci/workbench/Preferences",
	"davinci/ve/States",
	"davinci/commands/CompoundCommand",
	"davinci/ve/commands/StyleCommand",
	"davinci/actions/Action",
	"dojo/i18n!davinci/ve/nls/ve",
	"dojo/i18n!dijit/nls/common",
	"dojo/text!./templates/ManageStates.html",
	"dijit/form/Button"
], function(
	declare,
	domConstruct,
	On,
	domStyle,
	domClass,
	Event,
	_WidgetBase,
	_TemplatedMixin,
	_WidgetsInTemplateMixin,
	Runtime,
	Workbench,
	Preferences,
	States,
	CompoundCommand,
	StyleCommand,
	Action,
	veNls,
	commonNls,
	templateString,
	Button){

var NONE_VISIBLE = 0;
var ALL_VISIBLE = 1;
var SOME_VISIBLE = 2;

return declare("davinci.ve.actions._ManageStatesWidget", [_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
	templateString: templateString,
	widgetsInTemplate: true,
	anyCheckBoxChanges: false,
	_states:[],				// array of all states in doc
	_stateContainers:[],	// array of all corresponding stateContainer nodes
	_checkBoxes:[],	// TriStateCheckBoxes for each of the states
	_handlers:[],

	veNls: veNls,
	commonNls: commonNls,
	
	constructor: function(){
		this.handlers = [];
	},
	
	postCreate: function(){
		var context = this._getContext();
		if(!context){
			return;
		}
		var rootNode = context.rootNode;
		var manageStatesStatesListDiv = this.domNode.querySelector('.manageStatesStatesListDiv');
		if(manageStatesStatesListDiv){
			//Get list of all states (and corresponding stateContainers) in the doc
			var obj = this._getAllStatesInDoc();
			this._states = obj.states;
			this._stateContainers = obj.stateContainers;
			
			manageStatesStatesListDiv.style.width = '100%';
			manageStatesStatesListDiv.style.height = '100px';
			manageStatesStatesListDiv.style.border = '1px solid black';
			manageStatesStatesListDiv.style.overflowY = 'scroll';
			var manageStatesCheckAcceleratorsTable = this.domNode.querySelector('.manageStatesCheckAcceleratorsTable');
			if(manageStatesCheckAcceleratorsTable){
				manageStatesCheckAcceleratorsTable.style.width = '100%';
			}
			var manageStatesCheckCurrentStateOnlyCell = this.domNode.querySelector('.manageStatesCheckCurrentStateOnlyCell');
			if(manageStatesCheckCurrentStateOnlyCell){
				manageStatesCheckCurrentStateOnlyCell.style.textAlign = 'left';
			}
			var manageStatesCheckAllCell = this.domNode.querySelector('.manageStatesCheckAllCell');
			if(manageStatesCheckAllCell){
				manageStatesCheckAllCell.style.textAlign = 'center';
			}
			var manageStatesUncheckAllCell = this.domNode.querySelector('.manageStatesUncheckAllCell');
			if(manageStatesUncheckAllCell){
				manageStatesUncheckAllCell.style.textAlign = 'right';
			}
			
			//Create table with TriStateCheckBox in col 1 and state name in col 2
			var table, tr, td, div;
			table = domConstruct.create('table', 
					{'class':'manageStatesStatesListTable',
					style:'width:100%',
					border:0, cellspacing:0, cellpadding:3}, 
					manageStatesStatesListDiv);
			for(var i=0; i<this._states.length; i++){
				tr = domConstruct.create('tr', {}, table);
				td = domConstruct.create('td', {'class':'manageStatesCheckboxCell'}, tr);
				this._checkBoxes[i] = domConstruct.create('div', {id:'manageStatesCheckBox_'+i, 'class':'manageStatesCheckbox'}, td);
				On(this._checkBoxes[i], 'click', function(checkbox, event){
					this.anyCheckBoxChanges = true;
					domClass.remove(checkbox, 'manageStatesCheckboxNoneVisible');
					domClass.remove(checkbox, 'manageStatesCheckboxAllVisible');
					domClass.remove(checkbox, 'manageStatesCheckboxSomeVisible');
					if(checkbox._checkValue == ALL_VISIBLE){
						checkbox._checkValue = NONE_VISIBLE;
						domClass.add(checkbox, 'manageStatesCheckboxNoneVisible');
					}else{
						checkbox._checkValue = ALL_VISIBLE;
						domClass.add(checkbox, 'manageStatesCheckboxAllVisible');
					}
				}.bind(this, this._checkBoxes[i]));
				var state = this._states[i];
				var stateDisplayName = state == 'Normal' ? 'Background' : state;
				domConstruct.create('td', {'class':'manageStatesStateNameCell', innerHTML:stateDisplayName}, tr);
			}
		}
		var manageStatesCheckCurrentStateOnly = this.domNode.querySelector('.manageStatesCheckCurrentStateOnly');
		if(manageStatesCheckCurrentStateOnly){
			this._handlers.push(
				On(manageStatesCheckCurrentStateOnly, 'click', function(event){
					Event.stop(event);
					this._acceleratorClicked('current');
				}.bind(this))
			);
		}
		var manageStatesCheckAll = this.domNode.querySelector('.manageStatesCheckAll');
		if(manageStatesCheckAll){
			this._handlers.push(
				On(manageStatesCheckAll, 'click', function(event){
					Event.stop(event);
					this._acceleratorClicked('all');
				}.bind(this))
			);
		}
		var manageStatesUncheckAll = this.domNode.querySelector('.manageStatesUncheckAll');
		if(manageStatesUncheckAll){
			this._handlers.push(
				On(manageStatesUncheckAll, 'click', function(event){
					Event.stop(event);
					this._acceleratorClicked('none');
				}.bind(this))
			);
		}
		this.anyCheckBoxChanges = false;
	},
	
	/**
	 * User clicked on one of the accelerators
	 * @param value {'current'|'all'|'none'}
	 */
	_acceleratorClicked: function(type){
		var context = this._getContext();
		if(!context){
			return;
		}
		var statesFocus = States.getFocus(context.rootNode);
		if(!statesFocus || !statesFocus.stateContainerNode){
			return;
		}
		var currentState = States.getState(statesFocus.stateContainerNode);
		for(var i=0; i<this._states.length; i++){
			var state = this._states[i];
			if(state == 'undefined' || state == States.NORMAL){
				state = undefined;
			}
			var checkbox = this._checkBoxes[i];
			domClass.remove(checkbox, 'manageStatesCheckboxNoneVisible');
			domClass.remove(checkbox, 'manageStatesCheckboxAllVisible');
			domClass.remove(checkbox, 'manageStatesCheckboxSomeVisible');
			if(type == 'current'){
				if(state == currentState && statesFocus.stateContainerNode == this._stateContainers[i]){
					checkbox._checkValue = ALL_VISIBLE;
					domClass.add(checkbox, 'manageStatesCheckboxAllVisible');
				}else{
					checkbox._checkValue = NONE_VISIBLE;
					domClass.add(checkbox, 'manageStatesCheckboxNoneVisible');
				}
			}else if(type == 'all'){
				checkbox._checkValue = ALL_VISIBLE;
				domClass.add(checkbox, 'manageStatesCheckboxAllVisible');
			}else if(type == 'none'){
				checkbox._checkValue = NONE_VISIBLE;
				domClass.add(checkbox, 'manageStatesCheckboxNoneVisible');
			}
		}
		
	},

	_isValid: function() {
		return true;
	},

	_onKeyPress: function(e) {
		if (e.keyCode!=dojo.keys.ENTER) {
			if (this._isValid()) {
				this.okButton.set("disabled", false);
			} else {
				this.okButton.set("disabled", true);
			}
		}
	},
	
	/**
	 * Returns list of all states in document.
	 * @returns {states:[{string}], stateContainers:[{element}]}, 
	 *		where states is a list of all state names
	 *		and stateContainers is the corresponding stateContainer node
	 */
	_getAllStatesInDoc: function(){
		var context;
		if(Runtime.currentEditor && Runtime.currentEditor.currentEditor && Runtime.currentEditor.currentEditor.context){
			context = Runtime.currentEditor.currentEditor.context;
		}else{
			console.error('_ManageStatesWidget.js (from '+this._calledBy+' - cannot determine context.')
			return;
		}
		var states = [];
		var stateContainersList = [];
		var stateContainers = States.getAllStateContainers(context.rootNode);
		if(stateContainers){
			for(var i=0; i<stateContainers.length; i++){
				var statesList = States.getStates(stateContainers[i]);
				for(var j=0; j<statesList.length; j++){
					states.push(statesList[j]);
					stateContainersList.push(stateContainers[i]);
				}
			}
		}
		return {states:states, stateContainers:stateContainersList};
	},
	
	_getContext: function(){
		var context;
		if(Runtime.currentEditor && Runtime.currentEditor.currentEditor && Runtime.currentEditor.currentEditor.context){
			context = Runtime.currentEditor.currentEditor.context;
		}else{
			console.error('_ManageStatesWidget.js (from '+this._calledBy+' - cannot determine context.')
		}
		return context;
	},

	/**
	 * Returns list of all widgets to be effected by this dialog
	 * @returns [{widgets}]
	 */
	_getAllEffectedWidgets: function(){
		var context = this._getContext();
		if(!context){
			return [];
		}
		var statesFocus = States.getFocus(context.rootNode);
		if(!statesFocus || !statesFocus.stateContainerNode){
			return;
		}
		var currentState = States.getState(statesFocus.stateContainerNode);
		var obj = context.getAllWidgetsEffectiveDisplay(currentState);
		var allWidgets = obj.allWidgets;	// Array of all widgets
		var effectiveDisplay = obj.effectiveDisplay;	// Corresponding array of effective 'display' values
		var widgets = context.getSelection().slice(0);	// clone operation
		return widgets;
	},

	updateDialog: function(){
		var context = this._getContext();
		if(!context){
			return;
		}
		var statesFocus = States.getFocus(context.rootNode);
		if(!statesFocus || !statesFocus.stateContainerNode){
			return;
		}
		var widgets = this._getAllEffectedWidgets();
		for(var i=0; i<this._states.length; i++){
			var state = this._states[i];
			if(state == States.NORMAL || state == 'undefined'){
				state = undefined;
			}
			var count = 0;
			for(var j=0; j<widgets.length; j++){
				var widget = widgets[j];
				var obj = context.getEffectiveDisplayValue(widget, state);
				if(obj.effectiveDisplayValue.indexOf('none') != 0){
					if(!state && obj.effectiveState == 'undefined'){
						count++;
					}else if(state && obj.effectiveState == state){
						count++;
					}
				}
			}
			domClass.remove(this._checkBoxes[i], 'manageStatesCheckboxNoneVisible');
			domClass.remove(this._checkBoxes[i], 'manageStatesCheckboxAllVisible');
			domClass.remove(this._checkBoxes[i], 'manageStatesCheckboxSomeVisible');
			var checkbox = this._checkBoxes[i];
			if(count == 0){
				checkbox._checkValue = NONE_VISIBLE;
				domClass.add(checkbox, 'manageStatesCheckboxNoneVisible');
			}else if(count == widgets.length){
				checkbox._checkValue = ALL_VISIBLE;
				domClass.add(checkbox, 'manageStatesCheckboxAllVisible');
			}else{
				checkbox._checkValue = SOME_VISIBLE;
				domClass.add(checkbox	, 'manageStatesCheckboxSomeVisible');
			}
		}
	},

	onOk: function() {
		if(!this.anyCheckBoxChanges){
			return;
		}
		var context = this._getContext();
		if(!context){
			return;
		}
		var command;
		var widgets = this._getAllEffectedWidgets();
		for(var i=0; i<this._states.length; i++){
			var state = this._states[i];
			if(state == States.NORMAL || state == 'undefined'){
				state = undefined;
			}
			var value = this._checkBoxes[i]._checkValue;
			if(value === NONE_VISIBLE || value === ALL_VISIBLE){
				for(var j=0; j<widgets.length; j++){
					var widget = widgets[j];
					if(!command){
						command = new CompoundCommand();
					}
					var displayValue = value == ALL_VISIBLE ? '' : 'none';
					command.add(new StyleCommand(widget, [{'display':displayValue}], state));
				}
			}
		}
		if(command){
			context.getCommandStack().execute(command);
		}
	},

	onCancel: function() {
		this.onClose();
	},

	destroy: function(){
		this.inherited(arguments);
		for(var i=0; i<this._handlers.length; i++){
			this._handlers[i].remove();
		}
		this._handlers = [];
	}
});

});