'use strict';
var dom = require('../services/dom');

module.exports = function (result, args) {
  var bindings = result.bindings;

  // add some stuff to the bindings
  bindings.required = args.required;

  var tpl = `
      <label><span class="input-label">{ label }</span> 
        <input name="${bindings.name}" type="text" rv-required="required" rv-pattern="pattern" rv-minLength="minLength" rv-maxLength="maxLength" rv-placeholder="placeholder" rv-value="data" />
      </label>
    `,
    textField = dom.create(tpl);

  result.el = textField;

  return result;
};