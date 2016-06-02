var GITHUB_API_URL = "https://api.github.com";

var assignedPRs = [];
var createdPRs = [];

// Filter issues to keep only pull requests
var filterPullRequests = function(issues) {
    return issues.filter(function(issue) {
        return issue.pull_request;
    });
};

var retrievePRs = function(type) {
    var issues = [];

    var findPRs = function(page) {
        if (!page) {
            findPRs.deferred = new jQuery.Deferred();
        }
        page = page || 1;
        $.get(GITHUB_API_URL + "/issues", {
                access_token: Cookies.get("ghToken"),
                page: page,
                filter: type === "created" ? "created" : undefined
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
        if (type === "created") {
            createdPRs = filterPullRequests(issues);
        } else {
            assignedPRs = filterPullRequests(issues);
        }
        return $.Deferred().resolve(filterPullRequests(issues));
    });
};

var retrieveAssignedPRs = function() {
    $.when(retrievePRs("assigned")).done(function(assignedIssues) {
        chrome.browserAction.setBadgeText({
            text: (assignedIssues.length).toString()
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

        setTimeout(background, 120000);
    })();
});
