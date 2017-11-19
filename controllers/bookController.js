var Book = require('../models/book');
var Author = require('../models/author');
var Genre = require('../models/genre');
var BookInstance = require('../models/bookinstance');

var async = require('async');

var debug = require('debug')('book-controller');

exports.index = function(req, res) {   
		//get all counts in parallel.
		async.parallel({
				book_count: function(callback) {
						Book.count(callback);
				},
				book_instance_count: function(callback) {
						BookInstance.count(callback);
				},
				book_instance_available_count: function(callback) {
						BookInstance.count({status:'Available'}, callback);
				},
				author_count: function(callback) {
						Author.count(callback);
				},
				genre_count: function(callback) {
						Genre.count(callback);
				},
		}, function(err, results) {
				//render data with results objects
				res.render('index', { title: 'Local Library Home', error: err, data: results });
		});
};

// Display list of all books
exports.book_list = function(req, res, next) {

	Book.find({}, 'title author')
		.populate('author')
		.exec(function (err, list_books) {
			//get only title and author, also _id and virtual fields will be generated
			if (err) { return next(err); }
			//Successful, so render
			res.render('book/book_list', { title: 'Book List', book_list: list_books });
		});
		
};

// Display detail page for a specific book
exports.book_detail = function(req, res, next) {
	async.parallel({
		book: function(callback){
			Book.findById(req.params.id)
			.populate('author')
			.populate('genre')
			.exec(callback);
		},
		book_instance: function(callback){
			BookInstance.find({ 'book': req.params.id })
			//.populate('book')
			.exec(callback);
		},
	},
	function(err, results){
		if(err){
			return next(err);
		}
		res.render('book/book_detail',
			{
				title: 'Title', 
				book: results.book,
				book_instance: results.book_instance,
			}
		)
	});
};

// Display book create form on GET
exports.book_create_get = function(req, res, next) {
	//Get all authors and genres, which we can use for adding to our book.
	async.parallel({
		authors: function(callback) {
				Author.find(callback);
		},
		genres: function(callback) {
				Genre.find(callback);
		},
	}, function(err, results) {
		if (err) { return next(err); }
		res.render('book/book_form', { title: 'Create Book', authors: results.authors, genres: results.genres });
	});
};

// Handle book create on POST
exports.book_create_post = function(req, res, next) {
	req.checkBody('title', 'Title must not be empty.').notEmpty();
	req.checkBody('author', 'Author must not be empty').notEmpty();
	req.checkBody('summary', 'Summary must not be empty').notEmpty();
	req.checkBody('isbn', 'ISBN must not be empty').notEmpty();

	req.sanitize('title').escape();
	req.sanitize('author').escape();
	req.sanitize('summary').escape();
	req.sanitize('isbn').escape();
	req.sanitize('title').trim();     
	req.sanitize('author').trim();
	req.sanitize('summary').trim();
	req.sanitize('isbn').trim();
	//needs to be checked
	//req.sanitize('genre').escape();
	var book = new Book({
		title: req.body.title, 
		author: req.body.author, 
		summary: req.body.summary,
		isbn: req.body.isbn,
		genre: (typeof req.body.genre==='undefined') ? [] : req.body.genre
	});
	debug('Book:' + book);

	var errors = req.validationErrors();
	if(errors){
		//we need to re-render
		async.parallel({
			authors: function(callback) {
					Author.find(callback);
			},
			genres: function(callback) {
					Genre.find(callback);
			},
		}, function(err, results) {
			if (err) { return next(err); }
			// Mark our selected genres as checked
			for (i = 0; i < results.genres.length; i++) {
				if (book.genre.indexOf(results.genres[i]._id) > -1) {
					//Current genre is selected. Set "checked" flag.
					results.genres[i].checked='true';
				}
			}
			res.render('book/book_form', 
				{ title: 'Create Book',authors:results.authors,
				 genres:results.genres, book: book, errors: errors}); 
		});
	}else{
		//valid form entry
		book.save(function(err){
			if(err){next(err);}
			res.redirect(book.url);
		});
	}
};

// Display book delete form on GET
exports.book_delete_get = function(req, res, next) {
	async.parallel(
		{
			bookinstances: function(callback){
				BookInstance.find({'book': req.params.id})
					.exec(callback);
			},
			book: function(callback){
				Book.findById(req.params.id)
					.exec(callback);
			}
		},
		function(err,results){
			if(err){
				return next(err);
			}
			//success
			res.render('book/book_delete', {
				'title': 'Delete Book',
				book: results.book,
				bookinstances: results.bookinstances,
			});
		}
	);
};

// Handle book delete on POST
exports.book_delete_post = function(req, res, next) {
	req.checkBody('bookId', 'Book id must not be empty').notEmpty();
	async.parallel(
		{
			bookinstances: function(callback){
				BookInstance.find({'book': req.body.bookid})
					.exec(callback);
			},
			book: function(callback){
				Book.findById(req.body.bookid)
					.exec(callback);
			}
		},
		function(err,results){
			if(err){
				return next(err);
			}
			//success
			if(results.bookinstances.length > 0){
				res.render('book/book_delete', {
					'title': 'Delete Book',
					book: results.book,
					bookinstances: results.bookinstances,
				});
			}else{
				Book.findByIdAndRemove(req.body.bookid, function(err){
					if(err){
						return next(err);
					}
					//success
					res.redirect('/catalog/books');
				});
			}
		}
	);
};

// Display book update form on GET
exports.book_update_get = function(req, res, next) {
	req.sanitize('id').escape();
	req.sanitize('id').trim();

	async.parallel({
		book: function(callback){
			Book.findById(req.params.id)
				.populate('author')
				.populate('genre')
				.exec(callback);
		},
		genres: function(callback){
			Genre.find(callback);
		},
		authors: function(callback){
			Author.find(callback);
		}
	},function(err, results){
		if(err){return next(err);}
		//mark book selected genres
		for(var i = 0; i < results.genres.length; i++){
			for(var j = 0 ; j < results.book.genre.length; j++){
				if (results.genres[i]._id.toString()==results.book.genre[j]._id.toString()) {
					results.genres[all_g_iter].checked='true';
				}
			}
		}
		res.render('book/book_form', 
			{
			 title: 'Update Book',
			 authors:results.authors,
			 genres:results.genres,
			 book: results.book 
			}
		);
	});
};

// Handle book update on POST
exports.book_update_post = function(req, res) {
	//Sanitize id passed in. 
  req.sanitize('id').escape();
  req.sanitize('id').trim();
  
  //Check other data
  req.checkBody('title', 'Title must not be empty.').notEmpty();
  req.checkBody('author', 'Author must not be empty').notEmpty();
  req.checkBody('summary', 'Summary must not be empty').notEmpty();
  req.checkBody('isbn', 'ISBN must not be empty').notEmpty();
  
  req.sanitize('title').escape();
  req.sanitize('author').escape();
  req.sanitize('summary').escape();
  req.sanitize('isbn').escape();
  req.sanitize('title').trim();
  req.sanitize('author').trim(); 
  req.sanitize('summary').trim();
  req.sanitize('isbn').trim();
  

  var book = new Book(
	  { title: req.body.title, 
	    author: req.body.author, 
	    summary: req.body.summary,
	    isbn: req.body.isbn,
	    genre: (typeof req.body.genre==='undefined') ? [] : req.body.genre.split(","),
	    _id:req.params.id //This is required, or a new ID will be assigned!
	  }
  );
  var errors = req.validationErrors();
  if(errors){
  	async.parallel({
      authors: function(callback) {
        Author.find(callback);
      },
      genres: function(callback) {
        Genre.find(callback);
      },
    }, function(err, results) {
      if (err) { return next(err); }
      
      // Mark our selected genres as checked
      for (i = 0; i < results.genres.length; i++) {
        if (book.genre.indexOf(results.genres[i]._id) > -1) {
          results.genres[i].checked='true';
        }
      }
      res.render('book/book_form',
       	{
	        title: 'Update Book',
	        authors:results.authors,
	        genres:results.genres, 
	        book: book, 
	        errors: errors 
      	}
      );
    });
  }else{
  	Book.findByIdAndUpdate(req.params.id, book, {}, function (err,thebook) {
      if (err) { return next(err); }
      res.redirect(thebook.url);
    });
  }
};