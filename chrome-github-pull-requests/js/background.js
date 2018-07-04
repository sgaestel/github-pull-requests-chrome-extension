var GITHUB_API_URL = 'https://api.github.com';

var assignedPRs = [];
var createdPRs = [];
var reviewPRs = [];

var retrievePRDetails = function(repo, number) {
  var lastComment = null;

  var findPRDetails = function() {
    return $.get({
      url: GITHUB_API_URL + '/' + ['repos', repo, 'pulls', number].join('/'),
      beforeSend: function(xhr) {
        xhr.setRequestHeader('Accept', 'application/vnd.github.v3+json');
      },
      data: {
        access_token: Cookies.get('ghToken')
      }
    });
  };

  var findLastPRComment = function(page) {
    if (!page) {
      findLastPRComment.deferred = new jQuery.Deferred();
    }
    page = page || 1;
    $.get({
      url: GITHUB_API_URL + '/' + ['repos', repo, 'issues', number, 'comments'].join('/'),
      beforeSend: function(xhr) {
        xhr.setRequestHeader('Accept', 'application/vnd.github.v3+json');
      },
      data: {
        access_token: Cookies.get('ghToken'),
        page: page
      }
    }).done(function(data) {
      if (data.length) {
        lastComment = data[data.length - 1];
      }
      if (data.length === 30) {
        findLastPRComment(page + 1);
      } else {
        findLastPRComment.deferred.resolve();
      }
    });

    return findLastPRComment.deferred.promise();
  };

  $.when(findPRDetails(), findLastPRComment()).done(function(prDetails) {
    chrome.runtime.sendMessage({
      type: 'prDetails',
      pr: prDetails[0],
      lastComment: lastComment
    });
  });
};

var retrievePRs = function(type) {
  var PRs = [];

  var filter = '&q=type:pr+state:open';
  if (Cookies.get('ghOrganization')) {
    filter = filter + '+user:' + Cookies.get('ghOrganization');
  }

  if (type === 'created') {
    filter = filter + '+author:' + Cookies.get('ghUser');
  } else if (type === 'assigned') {
    filter = filter + '+assignee:' + Cookies.get('ghUser');
  } else {
    filter = filter + '+review-requested:' + Cookies.get('ghUser');
  }

  var findPRs = function(page) {
    if (!page) {
      findPRs.deferred = new jQuery.Deferred();
    }
    page = page || 1;
    $.get({
      url: GITHUB_API_URL + '/search/issues',
      beforeSend: function(xhr) {
        xhr.setRequestHeader('Accept', 'application/vnd.github.v3+json');
      },
      data:
        $.param({
          access_token: Cookies.get('ghToken'),
          page: page
        }) + filter
    }).done(function(data) {
      PRs = PRs.concat(data.items);
      if (data.length === 100) {
        findPRs(page + 1);
      } else {
        findPRs.deferred.resolve();
      }
    });
    return findPRs.deferred.promise();
  };

  return $.when(findPRs()).then(function() {
    if (type === 'created') {
      $.each(PRs, function(index, pullRequest) {
        var prExists = assignedPRs.find(function(pr) {
          return pr.id === pullRequest.id;
        });
        if (prExists && pullRequest.comments > prExists.comments) {
          chrome.notifications.create('newComment-' + pullRequest.number, {
            type: 'basic',
            iconUrl: '../icon.png',
            title: 'New comment in Pull Request',
            message: '#' + pullRequest.number + ' - ' + pullRequest.title,
            contextMessage: 'Repository: ' + pullRequest.repository_url.replace('https://api.github.com/repos/', ''),
            buttons: [
              {
                title: 'Go to Pull Request'
              }
            ]
          });
        }
      });
      createdPRs = PRs;
    } else if (type === 'assigned') {
      $.each(PRs, function(index, pullRequest) {
        var prExists = assignedPRs.find(function(pr) {
          return pr.id === pullRequest.id;
        });
        if (!prExists) {
          chrome.notifications.create('newPR-' + pullRequest.number, {
            type: 'basic',
            iconUrl: '../icon.png',
            title: 'A new Pull Request has been assigned to you.',
            message: '#' + pullRequest.number + ' - ' + pullRequest.title,
            contextMessage: 'Repository: ' + pullRequest.repository_url.replace('https://api.github.com/repos/', ''),
            buttons: [
              {
                title: 'Go to Pull Request'
              }
            ]
          });
        } else {
          if (pullRequest.comments > prExists.comments) {
            chrome.notifications.create('newComment-' + pullRequest.number, {
              type: 'basic',
              iconUrl: '../icon.png',
              title: 'New comment in Pull Request',
              message: '#' + pullRequest.number + ' - ' + pullRequest.title,
              contextMessage: 'Repository: ' + pullRequest.repository_url.replace('https://api.github.com/repos/', ''),
              buttons: [
                {
                  title: 'Go to Pull Request'
                }
              ]
            });
          }
        }
      });
      assignedPRs = PRs;
    } else {
      $.each(PRs, function(index, pullRequest) {
        var prExists = reviewPRs.find(function(pr) {
          return pr.id === pullRequest.id;
        });
        if (!prExists) {
          chrome.notifications.create('newPRreview-' + pullRequest.number, {
            type: 'basic',
            iconUrl: '../icon.png',
            title: 'You have been added as a reviewer for a pull request.',
            message: '#' + pullRequest.number + ' - ' + pullRequest.title,
            contextMessage: 'Repository: ' + pullRequest.repository_url.replace('https://api.github.com/repos/', ''),
            buttons: [
              {
                title: 'Go to Pull Request'
              }
            ]
          });
        }
      });
      reviewPRs = PRs;
    }
    return $.Deferred().resolve(PRs);
  });
};

chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex) {
  var prNumber = notificationId.split('-')[1];

  chrome.tabs.create({
    url: assignedPRs.concat(createdPRs).find(function(pr) {
      return pr.number.toString() === prNumber;
    }).html_url
  });
});

var updateBadge = function() {
  var counter = assignedPRs.length || 0;

  reviewPRs.forEach(function(pr) {
    if (
      !assignedPRs.find(function(assPr) {
        return assPr.id === pr.id;
      })
    ) {
      counter++;
    }
  });

  chrome.browserAction.setBadgeText({
    text: counter ? counter.toString() : ''
  });
  chrome.browserAction.setBadgeBackgroundColor({
    color: [27, 86, 224, 255]
  });
};

var retrieveAssignedPRs = function() {
  $.when(retrievePRs('assigned')).done(function(assignedIssues) {
    updateBadge();

    chrome.runtime.sendMessage({
      type: 'assigned',
      prs: assignedIssues
    });
  });
};

var retrieveCreatedPRs = function() {
  $.when(retrievePRs('created')).done(function(createdIssues) {
    chrome.runtime.sendMessage({
      type: 'created',
      prs: createdIssues
    });
  });
};

var retrieveReviewPRs = function() {
  $.when(retrievePRs('review')).done(function(reviewIssues) {
    updateBadge();

    chrome.runtime.sendMessage({
      type: 'review',
      prs: reviewIssues
    });
  });
};

var getAssignedPRs = function() {
  return assignedPRs;
};

var getCreatedPRs = function() {
  return createdPRs;
};

var getReviewPRs = function() {
  return reviewPRs;
};

$(function() {
  (function background() {
    retrieveAssignedPRs();
    retrieveCreatedPRs();
    retrieveReviewPRs();

    setTimeout(background, Cookies.get('ghPollingInterval') ? Cookies.get('ghPollingInterval') * 60000 : 120000);
  })();
});
