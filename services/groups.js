var _ = require('lodash'),
  references = require('./references');

/**
 * expand fields array
 * @param {array} fields
 * @param {object} data
 * @returns {array} expanded
 */
function expandFields(fields, data) {
  if (!_.isArray(fields)) {
    throw new Error('Please provide an array of fields!');
  }

  return _.map(fields, function (field) {
    var expanded = _.get(data, field);

    if (!expanded) {
      throw new Error('Field (' + field + ') doesn\'t exist in the schema!');
    }

    return expanded;
  });
}

/**
 * get only the fields with _display: settings
 * @param {object} data
 * @returns {array}
 */
function getSettingsFields(data) {
  if (!_.isObject(data) || _.isEmpty(data)) {
    return [];
  }

  return _.reduce(data, function (fields, fieldData) {
    if (fieldData._schema && fieldData._schema[references.displayProperty] === 'settings') {
      fields.push(fieldData);
    }

    return fields;
  }, []);
}

/**
 * get fields from a component's data
 * @param {string} ref
 * @param {object} data
 * @param {string} [path]
 * @returns {object}
 */
function get(ref, data, path) {
  var field = _.get(data, path),
    group = data._schema && data._schema[references.groupsProperty] && _.get(data._schema[references.groupsProperty], path),
    expanded;

  if (field) {
    // simply return the field
    _.set(field, '_schema._name', path);
    return field;
  } else if (group) {
    // return the expanded group
    expanded = expandFields(group.fields, data);
    return {
      value: expanded,
      _schema: _.assign({ _name: path }, group)
    };
  } else if (!path) {
    // return the settings group
    expanded = getSettingsFields(data);
    return {
      value: expanded,
      _schema: {
        _display: 'settings',
        _label: _.startCase(references.getComponentNameFromReference(ref)) + ' Settings',
        _name: 'settings'
      }
    };
  } else {
    // this isn't a field or a group, and they expect something at this path
    throw new Error('No group or field found at "' + path + '"');
  }
}

module.exports.expandFields = expandFields;
module.exports.getSettingsFields = getSettingsFields;
module.exports.get = get;