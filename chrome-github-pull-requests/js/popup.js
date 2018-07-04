$(function() {
  chrome.runtime.getBackgroundPage(function(bgScript) {
    var markdownConverter = new showdown.Converter();

    // Allow opening links in a new tab
    $('body').on('click', 'a.link', function() {
      chrome.tabs.create({
        url: $(this).attr('href')
      });
      return false;
    });

    // Get PR details
    $('body').on('click', 'a.prDetailsLink', function() {
      bgScript.retrievePRDetails($(this).attr('data-repository'), $(this).attr('data-number'));
    });

    // Listener for background script
    chrome.runtime.onMessage.addListener(function(message) {
      if (message.type === 'prDetails') {
        showPRDetails(message.pr, message.lastComment);
      } else {
        createIssuesTableView(message.type, message.prs);
      }
    });

    var showPRDetails = function(prDetails, prLastComment) {
      var $assigneeView = (function() {
        if (prDetails.assignee) {
          return $('<img>', {
            src: prDetails.assignee.avatar_url,
            title: prDetails.assignee.login,
            class: 'assignee-img'
          });
        }
        return $('<span>').text('Unassigned');
      })();

      var htmlComment = function(comment) {
        return comment
          .replace(/\n/g, '<br>')
          .replace(/:white_check_mark:/g, '<i class="fa fa-lg fa-check-square"></i>')
          .replace(/:red_circle:/g, '<i class="fa fa-lg fa-circle"></i>')
          .replace(/:\+1:/g, '<i class="fa fa-thumbs-o-up"></i>');
      };

      $('#pullRequestDetails').empty();
      $('#pullRequestDetails').append(
        $('<h4>').append(
          $('<button>', {
            class: 'btn btn-sm btn-default',
            id: 'backToList'
          }).append(
            $('<i>', {
              class: 'fa fa-arrow-left'
            }),
            $('<span>').text(' Back')
          ),
          $('<a>', {
            class: 'link',
            style: 'padding-left: 5px;',
            href: prDetails.html_url
          }).text('#' + prDetails.number + ' - ' + prDetails.title)
        ),
        $('<table>', {
          class: 'table'
        }).append(
          $('<tr>').append($('<th>').text('Assignee'), $('<td>').append($assigneeView)),
          $('<tr>').append(
            $('<th>').text('Automatically Mergeable'),
            $('<td>').append(
              $('<i>', {
                class: 'fa ' + (prDetails.mergeable ? 'fa-lg fa-check-square' : 'fa-lg fa-circle')
              })
            )
          ),
          $('<tr>').append($('<th>').text('Comments'), $('<td>').text(prDetails.comments)),
          (function() {
            if (prDetails.comments) {
              return $('<tr>').append(
                $('<th>').text('Last Comment'),
                $('<td>').append(
                  $('<img>', {
                    src: prLastComment.user.avatar_url,
                    title: prLastComment.user.login,
                    class: 'assignee-img'
                  }),
                  $('<strong>').text(' ' + prLastComment.user.login),
                  $('<div>').text(new Date(prLastComment.created_at).toString()),
                  $('<div>').html(markdownConverter.makeHtml(htmlComment(prLastComment.body)))
                )
              );
            }
            return null;
          })()
        )
      );

      $('#pullRequests').hide();
      $('#pullRequestDetails').show();
    };

    var createIssuesTableView = function(type, issues) {
      var containerName = type + 'PullRequests';
      $('#' + type + 'PRsCount').text(issues.length || '');
      // Create view for each PR
      var createIssueView = function(issue) {
        var repoName = issue.repository_url.replace('https://api.github.com/repos/', '');
        var $pullRequestLink = $('<a>', {
          class: 'link',
          href: issue.html_url
        }).text('#' + issue.number + ' - ' + issue.title);

        var splittedUrl = issue.repository_url.split('/');

        var $projectView = $('<a>', {
          class: 'link',
          href: issue.html_url.split('/pull')[0]
        }).text(repoName);

        var $assigneeView = (function() {
          if (issue.assignee) {
            return $('<img>', {
              src: issue.assignee.avatar_url,
              title: issue.assignee.login,
              class: 'assignee-img'
            });
          }
          return null;
        })();

        var $detailsView = $('<a>', {
          'data-repository': repoName,
          'data-number': issue.number,
          class: 'clickable prDetailsLink'
        }).text('>');

        return $('<tr>').append(
          $('<td>').append($assigneeView),
          $('<td>').append($projectView),
          $('<td>').append($pullRequestLink),
          $('<td>').append($detailsView)
        );
      };

      $('#' + containerName).empty();

      if (issues.length !== 0) {
        var $table = $('<table>', {
          class: 'table'
        }).append($('<thead>').append($('<th>').text('Assignee'), $('<th>').text('Project'), $('<th>').text('Name')));
        $.each(issues, function(index, issue) {
          $table.append(createIssueView(issue));
        });
        $('#' + containerName).append($table);
      } else {
        $('#' + containerName).append($('<h5>').text('No Pull Request.'));
      }
    };

    var beforeSettingsShown;
    var toggleSettings = function() {
      if (beforeSettingsShown) {
        $('#' + beforeSettingsShown).toggle();
        beforeSettingsShown = null;
      } else {
        beforeSettingsShown = $('#pullRequests').is(':visible') ? 'pullRequests' : 'pullRequestDetails';
        $('#' + beforeSettingsShown).toggle();
      }

      $('#settings').toggle();
    };

    $('#settingsBtn, #cancelSettingsBtn').on('click', function() {
      toggleSettings();
    });

    $('#applySettingsBtn').on('click', function() {
      if ($('#ghToken').val() !== '') {
        Cookies.set('ghToken', $('#ghToken').val(), {
          expires: 365 * 10
        });
      }
      if ($('#ghPollingInterval').val() !== '') {
        Cookies.set('ghPollingInterval', parseInt($('#ghPollingInterval').val()), {
          expires: 365 * 10
        });
      }

      if ($('#ghUser').val() !== '') {
        Cookies.set('ghUser', $('#ghUser').val(), {
          expires: 365 * 10
        });
      }

      Cookies.set('ghOrganization', $('#ghOrganization').val(), {
        expires: 365 * 10
      });

      bgScript.retrieveAssignedPRs();
      bgScript.retrieveCreatedPRs();
      bgScript.retrieveReviewPRs();
      toggleSettings();
    });

    // Allow refreshing the list of PRs
    $('#refreshPRlist').on('click', function() {
      bgScript.retrieveAssignedPRs();
      bgScript.retrieveCreatedPRs();
      bgScript.retrieveReviewPRs();
    });

    $('body').on('click', '#backToList', function() {
      $('#pullRequestDetails').hide();
      $('#pullRequests').show();
    });

    // Init settings values
    $('#ghToken').val(Cookies.get('ghToken') || '');
    $('#ghPollingInterval').val(Cookies.get('ghPollingInterval') || 2);
    $('#ghUser').val(Cookies.get('ghUser') || '');
    $('#ghOrganization').val(Cookies.get('ghOrganization') || '');

    createIssuesTableView('assigned', bgScript.getAssignedPRs());
    createIssuesTableView('created', bgScript.getCreatedPRs());
    createIssuesTableView('review', bgScript.getReviewPRs());
  });
});
