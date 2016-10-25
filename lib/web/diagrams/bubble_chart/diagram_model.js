var _  = require('lodash'),
    ko = require('knockout');

var mustacheHelper = require('../../helpers/mustache_helper.js');

module.exports = function(diameter, nodesArray, nodeHelper) {
  var self = this;
  this.rootNode = nodesArray[0];
  this.visibleSeries = ko.observable(nodesArray);
  var currentSelection;

  this.seriesValues = _.map(nodesArray, 'value');

  this.updateVisibleSeries = function(filters) {
    this.visibleSeries(_.filter(nodesArray, function(node){
      var nodeWeight = nodeHelper.nodeWeight(node);
      var isNodeAboveWeightThreshold = _.isUndefined(nodeWeight) || (_.isNumber(nodeWeight) && nodeWeight >= filters.weightFilter.outputValue());

      var isNodeAboveValueThreshold = _.isNumber(node.value) && node.value >= filters.valueFilter.outputValue();

      return node.isRoot() || (isNodeAboveWeightThreshold && isNodeAboveValueThreshold);
    }));
  };

  this.selectedNodes = [];

  this.selectNodes = function(targetNode) {
    if (currentSelection === targetNode) {
      this.selectedNodes = [];
      currentSelection = undefined;
    } else {
      this.selectedNodes = nodeHelper.selectionLinkedNodes(targetNode, nodesArray);
      currentSelection = targetNode;
    }
  };

  var nodeSelected = function(node) {
    return currentSelection ===  node || _.includes(self.selectedNodes, node);
  };

  var nodeClass = function(node) {
    var baseClass = nodeHelper.circleNodeClass(node);
    if (nodeSelected(node)) { baseClass += ' selected'; }
    return baseClass;
  };

  var nodeFillOpacity = function(node) {
    return nodeSelected(node) ? 1 : nodeHelper.circleNodeOpacity(node);
  };

  var nodeFillColor = function(node) {
    if (nodeSelected(node)) {
      return nodeHelper.selectedNodeColor(currentSelection, node);
    } else if (node.parent) {
      return nodeHelper.circleNodeColor(node);
    }
  };

  this.chartDefinitions = [
    {
      name: 'main',
      properties: {
        attributes: { class: 'circle-pack', width: diameter, height: diameter }
      },
      data: {
        dataElements: [
          {
            key: 'node-data',
            series: nodesArray,
            graphicElements: [
              {
                type: 'circle',
                properties: {
                  offset: nodeHelper.nodeOffset,
                  attributes: {
                    class: nodeClass,
                    r: nodeHelper.circleNodeRadius
                  },
                  style: { fill: nodeFillColor, 'fill-opacity': nodeFillOpacity }
                },
                tooltip: {
                  properties: {
                    attributes: { class: 'd3-tip circle-packing-diagram' },
                    html: function(node) {
                      var args = nodeSelected(node) && currentSelection !== node ? nodeHelper.selectedNodeTooltipTemplateArgs(currentSelection, node) : nodeHelper.nodeTooltipTemplateArgs(node);
                      return mustacheHelper.renderTemplate.apply(null, args);
                    }
                  },
                  actions: {
                    show: { event: 'mouseover' }, hide: { event: 'mouseout' }
                  }
                }
              },
              {
                type: 'text',
                properties: {
                  attributes: { class: 'label' },
                  offset: nodeHelper.nodeOffset,
                  text: nodeHelper.circleTextContent
                }
              }
            ]
          }
        ]
      },
      updateStrategy: {
        dataElements: [
          {
            key: 'node-data',
            method: 'repaintData',
            arguments: [
              {
                type: 'circle',
                properties: {
                  attributes: { class: nodeClass },
                  style: { fill: nodeFillColor, 'fill-opacity': nodeFillOpacity }
                }
              }
            ]
          }
        ]
      }
    }
  ];
};