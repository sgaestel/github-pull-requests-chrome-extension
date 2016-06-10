var GITHUB_API_URL = "https://api.github.com";

var assignedPRs = [];
var createdPRs = [];

// Filter issues to keep only pull requests
var filterPullRequests = function(issues) {
    return issues.filter(function(issue) {
        return issue.pull_request;
    });
};

var retrievePRDetails = function(repo, number) {
    var lastComment = null;

    var findPRDetails = function() {
        return $.get({
            url: GITHUB_API_URL + "/" + ["repos", repo, "pulls", number].join("/"),
            beforeSend: function(xhr) {
                xhr.setRequestHeader("Accept", "application/vnd.github.v3+json");
            },
            data: {
                access_token: Cookies.get("ghToken")
            }
        });
    };

    var findLastPRComment = function(page) {
        if (!page) {
            findLastPRComment.deferred = new jQuery.Deferred();
        }
        page = page || 1;
        $.get({
                url: GITHUB_API_URL + "/" + ["repos", repo, "issues", number, "comments"].join("/"),
                beforeSend: function(xhr) {
                    xhr.setRequestHeader("Accept", "application/vnd.github.v3+json");
                },
                data: {
                    access_token: Cookies.get("ghToken"),
                    page: page
                }
            })
            .done(function(data) {
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
            type: "prDetails",
            pr: prDetails[0],
            lastComment: lastComment
        });
    });
};

var retrievePRs = function(type) {
    var issues = [];

    var findPRs = function(page) {
        if (!page) {
            findPRs.deferred = new jQuery.Deferred();
        }
        page = page || 1;
        $.get({
                url: GITHUB_API_URL + "/issues",
                beforeSend: function(xhr) {
                    xhr.setRequestHeader("Accept", "application/vnd.github.v3+json");
                },
                data: {
                    access_token: Cookies.get("ghToken"),
                    page: page,
                    filter: type === "created" ? "created" : undefined
                }
            })
            .done(function(data) {
                issues = issues.concat(data);
                if (data.length === 30) {
                    findPRs(page + 1);
                } else {
                    findPRs.deferred.resolve();
                }
            });
        return findPRs.deferred.promise();
    };

    return $.when(findPRs()).then(function() {
        var PRs = filterPullRequests(issues);
        if (type === "created") {
            $.each(PRs, function(index, pullRequest) {
                var prExists = assignedPRs.find(function(pr) {
                    return pr.number === pullRequest.number;
                });
                if (prExists && pullRequest.comments > prExists.comments) {
                    chrome.notifications.create("newComment-" + pullRequest.number, {
                        type: "basic",
                        iconUrl: "../icon.png",
                        title: "New comment in Pull Request",
                        message: "#" + pullRequest.number + " - " + pullRequest.title,
                        contextMessage: "Repository: " + pullRequest.repository.full_name,
                        buttons: [{
                            title: "Go to Pull Request"
                        }]
                    });
                }
            });
            createdPRs = PRs;
        } else {
            $.each(PRs, function(index, pullRequest) {
                var prExists = assignedPRs.find(function(pr) {
                    return pr.number === pullRequest.number;
                });
                if (!prExists) {
                    chrome.notifications.create("newPR-" + pullRequest.number, {
                        type: "basic",
                        iconUrl: "../icon.png",
                        title: "A new Pull Request has been assigned to you.",
                        message: "#" + pullRequest.number + " - " + pullRequest.title,
                        contextMessage: "Repository: " + pullRequest.repository.full_name,
                        buttons: [{
                            title: "Go to Pull Request"
                        }]
                    });
                } else {
                    if (pullRequest.comments > prExists.comments) {
                        chrome.notifications.create("newComment-" + pullRequest.number, {
                            type: "basic",
                            iconUrl: "../icon.png",
                            title: "New comment in Pull Request",
                            message: "#" + pullRequest.number + " - " + pullRequest.title,
                            contextMessage: "Repository: " + pullRequest.repository.full_name,
                            buttons: [{
                                title: "Go to Pull Request"
                            }]
                        });
                    }
                }
            });
            assignedPRs = PRs;
        }
        return $.Deferred().resolve(PRs);
    });
};

chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex) {
    var prNumber = notificationId.split("-")[1];

    chrome.tabs.create({
        url: assignedPRs.concat(createdPRs).find(function(pr) {
            return pr.number.toString() === prNumber;
        }).html_url
    });
});

var retrieveAssignedPRs = function() {
    $.when(retrievePRs("assigned")).done(function(assignedIssues) {
        chrome.browserAction.setBadgeText({
            text: assignedIssues.length ? (assignedIssues.length).toString() : ""
        });
        chrome.browserAction.setBadgeBackgroundColor({
            color: [27, 86, 224, 255]
        });

        chrome.runtime.sendMessage({
            type: "assigned",
            prs: assignedIssues
        });
    });
};

var retrieveCreatedPRs = function() {
    $.when(retrievePRs("created")).done(function(createdIssues) {
        chrome.runtime.sendMessage({
            type: "created",
            prs: createdIssues
        });
    });
};

var getAssignedPRs = function() {
    return assignedPRs;
};

var getCreatedPRs = function() {
    return createdPRs;
};

$(function() {
    (function background() {
        retrieveAssignedPRs();
        retrieveCreatedPRs();

        setTimeout(background, Cookies.get("ghPollingInterval") ? Cookies.get("ghPollingInterval") * 60000 : 120000);
    })();
});
