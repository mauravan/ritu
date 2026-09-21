// jsdom lacks scrollIntoView; SearchView calls it after a successful search.
Element.prototype.scrollIntoView = () => {};
