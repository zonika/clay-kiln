'use strict';
var dom = require('./dom');

describe('dom service', function () {
  var el, childEl, secondChildEl;

  beforeEach(function () {
    // create el
    el = document.createElement('section');
    el.classList.add('parent-el');
    el.textContent = 'I am a section.';
    document.body.appendChild(el);

    // create child el
    childEl = document.createElement('div');
    childEl.classList.add('child-el');
    el.appendChild(childEl);

    // create second child el
    secondChildEl = document.createElement('div');
    secondChildEl.classList.add('second-child-el');
    el.appendChild(secondChildEl);
  });

  describe('find()', function () {
    it('finds selector in el', function () {
      expect(dom.find(el, 'div')).to.eql(el.querySelector('div'));
    });

    it('finds selector in document if no el passed in', function () {
      expect(dom.find('.child-el')).to.eql(document.querySelector('.child-el'));
    });

    it('returns null if no element found', function () {
      expect(dom.find('.foo')).to.eql(null);
    });
  });

  describe('findAll()', function () {
    it('finds selector in el', function () {
      expect(dom.findAll(el, 'div')).to.eql(el.querySelectorAll('div'));
    });

    it('finds selector in document if no el passed in', function () {
      expect(dom.findAll('.child-el')).to.eql(document.querySelectorAll('.child-el'));
    });

    it('returns empty NodeList if no elements found', function () {
      expect(dom.findAll('.foo')).to.eql(document.querySelectorAll('.foo'));
    });
  });

  describe('getFirstChildElement()', function () {
    it('gets the first child element', function () {
      expect(dom.getFirstChildElement(el)).to.eql(childEl);
    });

    it('does not get the second child element', function () {
      expect(dom.getFirstChildElement(el)).to.not.eql(secondChildEl);
    });
  });

  describe('prependChild()', function () {
    it('adds a child to an empty element', function () {
      var tmpEl = document.createDocumentFragment();

      dom.prependChild(tmpEl, childEl);
      expect(dom.find(tmpEl, 'div')).to.eql(childEl);
    });

    it('adds a child to an element with children', function () {
      var tmpEl = document.createDocumentFragment();
      tmpEl.appendChild(childEl);

      dom.prependChild(tmpEl, secondChildEl);
      expect(dom.find(tmpEl, 'div')).to.eql(secondChildEl);
    });
  });

  describe('clearChildren()', function () {
    it('removed all children', function () {
      dom.clearChildren(el);
      expect(dom.find(el, 'div')).to.eql(null);
    });
  });

  describe('removeElement()', function () {
    it('removes the element', function () {
      var tmpEl = document.createDocumentFragment();
      tmpEl.appendChild(childEl);

      dom.removeElement(childEl);
      expect(dom.find(tmpEl, 'div')).to.eql(null);
    });
  });

  describe('replaceElement()', function () {
    it('replaces in place', function () {
      var tmpEl = document.createDocumentFragment();
      tmpEl.appendChild(childEl);

      dom.replaceElement(childEl, secondChildEl);
      expect(dom.find(tmpEl, 'div')).to.eql(secondChildEl);
    });
  });
});